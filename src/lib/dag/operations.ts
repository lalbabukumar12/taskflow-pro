import mongoose, { Types } from "mongoose";
import Task from "@/models/Task";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId } from "@/lib/validations/task";
import {
  buildDependencyGraph,
  wouldCreateCycle,
  normalizeId,
  getTransitiveDownstreamIds,
  getTransitivePrerequisiteIds,
  TaskNode,
} from "./graph";
import {
  calculateTaskReadiness,
  calculateAllTaskStates,
  TaskReadinessDetail,
} from "./readiness";
import { formatTaskResponse, TaskWithDependencies } from "@/lib/services/taskService";

export class DagValidationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, code = "DAG_VALIDATION_ERROR", statusCode = 400) {
    super(message);
    this.name = "DagValidationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Validates and establishes a directed dependency edge: prerequisiteId -> dependentId
 * (dependentId will depend on prerequisiteId).
 *
 * Enforces:
 * - Valid MongoDB ObjectIds
 * - Target tasks exist in DB
 * - Rejects self-dependency (A -> A)
 * - Rejects duplicate dependency (A -> B if already present)
 * - Rejects cycles (A -> B -> C, then C -> A)
 */
export async function addDependency(
  prerequisiteIdInput: string | Types.ObjectId,
  dependentIdInput: string | Types.ObjectId
): Promise<{
  dependentTask: TaskWithDependencies;
  readiness: TaskReadinessDetail;
}> {
  await connectToDatabase();

  const prereqId = normalizeId(prerequisiteIdInput);
  const depId = normalizeId(dependentIdInput);

  // 1. Validate ID format
  if (!isValidObjectId(prereqId)) {
    throw new DagValidationError(
      `Invalid prerequisite taskId format: '${prereqId}'`,
      "INVALID_PREREQUISITE_ID"
    );
  }
  if (!isValidObjectId(depId)) {
    throw new DagValidationError(
      `Invalid dependent taskId format: '${depId}'`,
      "INVALID_DEPENDENT_ID"
    );
  }

  // 2. Reject self dependency
  if (prereqId === depId) {
    throw new DagValidationError(
      "Cannot add self-dependency: A task cannot depend on itself",
      "SELF_DEPENDENCY_REJECTED"
    );
  }

  // 3. Fetch all tasks to validate existence and evaluate cycle
  const allTasks = await Task.find({}).lean();
  const taskMap = new Map<string, any>();
  for (const t of allTasks) {
    taskMap.set(t._id.toString(), t);
  }

  const prereqTask = taskMap.get(prereqId);
  if (!prereqTask) {
    throw new DagValidationError(
      `Prerequisite task with id '${prereqId}' does not exist`,
      "PREREQUISITE_NOT_FOUND",
      404
    );
  }

  const depTask = taskMap.get(depId);
  if (!depTask) {
    throw new DagValidationError(
      `Dependent task with id '${depId}' does not exist`,
      "DEPENDENT_NOT_FOUND",
      404
    );
  }

  // 4. Reject duplicate dependency
  const existingDepIds = (depTask.dependencyIds || []).map((id: any) =>
    id.toString()
  );
  if (existingDepIds.includes(prereqId)) {
    throw new DagValidationError(
      `Duplicate dependency: Task '${depTask.title}' already depends on '${prereqTask.title}'`,
      "DUPLICATE_DEPENDENCY_REJECTED"
    );
  }

  // 5. Cycle detection: Would adding prereqId -> depId create a cycle?
  const createsCycle = wouldCreateCycle(
    allTasks as unknown as TaskNode[],
    prereqId,
    depId
  );
  if (createsCycle) {
    throw new DagValidationError(
      `Circular dependency detected: Adding dependency from '${prereqTask.title}' to '${depTask.title}' creates a cycle in the task graph`,
      "CYCLE_DETECTED"
    );
  }

  // 6. Persist valid dependency
  const updatedDoc = await Task.findByIdAndUpdate(
    depId,
    {
      $addToSet: { dependencyIds: new mongoose.Types.ObjectId(prereqId) },
    },
    { returnDocument: "after", runValidators: true }
  )
    .populate({
      path: "dependencyIds",
      select: "_id title status",
    })
    .lean();

  const refreshedTasks = await Task.find({}).lean();
  const readiness = calculateTaskReadiness(
    depId,
    refreshedTasks as unknown as TaskNode[]
  );
  const { calculateTaskDependencyState } = await import("./taskState");
  const depState = calculateTaskDependencyState(
    depId,
    refreshedTasks as unknown as TaskNode[]
  );

  return {
    dependentTask: formatTaskResponse(updatedDoc, depState),
    readiness,
  };
}

/**
 * Removes an existing directed dependency edge: prerequisiteId -> dependentId
 */
export async function removeDependency(
  prerequisiteIdInput: string | Types.ObjectId,
  dependentIdInput: string | Types.ObjectId
): Promise<{
  dependentTask: TaskWithDependencies;
  readiness: TaskReadinessDetail;
}> {
  await connectToDatabase();

  const prereqId = normalizeId(prerequisiteIdInput);
  const depId = normalizeId(dependentIdInput);

  if (!isValidObjectId(prereqId) || !isValidObjectId(depId)) {
    throw new DagValidationError("Invalid MongoDB taskId format", "INVALID_ID");
  }

  const updatedDoc = await Task.findByIdAndUpdate(
    depId,
    {
      $pull: { dependencyIds: new mongoose.Types.ObjectId(prereqId) },
    },
    { returnDocument: "after", runValidators: true }
  )
    .populate({
      path: "dependencyIds",
      select: "_id title status",
    })
    .lean();

  if (!updatedDoc) {
    throw new DagValidationError(
      `Dependent task with id '${depId}' not found`,
      "DEPENDENT_NOT_FOUND",
      404
    );
  }

  const refreshedTasks = await Task.find({}).lean();
  const readiness = calculateTaskReadiness(
    depId,
    refreshedTasks as unknown as TaskNode[]
  );
  const { calculateTaskDependencyState } = await import("./taskState");
  const depState = calculateTaskDependencyState(
    depId,
    refreshedTasks as unknown as TaskNode[]
  );

  return {
    dependentTask: formatTaskResponse(updatedDoc, depState),
    readiness,
  };
}

/**
 * Retrieves all downstream tasks that depend on taskId (directly or transitively).
 */
export async function getDownstreamTasks(
  taskIdInput: string | Types.ObjectId,
  options: { transitive?: boolean } = { transitive: true }
): Promise<TaskWithDependencies[]> {
  await connectToDatabase();

  const taskId = normalizeId(taskIdInput);
  if (!isValidObjectId(taskId)) {
    throw new DagValidationError("Invalid MongoDB taskId format", "INVALID_ID");
  }

  const allTasks = await Task.find({}).lean();
  const graph = buildDependencyGraph(allTasks as unknown as TaskNode[]);

  const downstreamIds = options.transitive
    ? getTransitiveDownstreamIds(graph, taskId)
    : Array.from(graph.downstream.get(taskId) || []);

  const downstreamSet = new Set(downstreamIds);
  const matched = allTasks.filter((t) => downstreamSet.has(t._id.toString()));

  return matched.map((t) => formatTaskResponse(t));
}

/**
 * Retrieves all prerequisite tasks that taskId depends on (directly or transitively).
 */
export async function getPrerequisiteTasks(
  taskIdInput: string | Types.ObjectId,
  options: { transitive?: boolean } = { transitive: true }
): Promise<TaskWithDependencies[]> {
  await connectToDatabase();

  const taskId = normalizeId(taskIdInput);
  if (!isValidObjectId(taskId)) {
    throw new DagValidationError("Invalid MongoDB taskId format", "INVALID_ID");
  }

  const allTasks = await Task.find({}).lean();
  const graph = buildDependencyGraph(allTasks as unknown as TaskNode[]);

  const prereqIds = options.transitive
    ? getTransitivePrerequisiteIds(graph, taskId)
    : Array.from(graph.prerequisites.get(taskId) || []);

  const prereqSet = new Set(prereqIds);
  const matched = allTasks.filter((t) => prereqSet.has(t._id.toString()));

  return matched.map((t) => formatTaskResponse(t));
}
