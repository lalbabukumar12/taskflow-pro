import mongoose from "mongoose";
import Task from "@/models/Task";
import { connectToDatabase } from "@/lib/db/connect";
import { CreateTaskInput, UpdateTaskInput } from "@/lib/validations/task";
import {
  calculateAllDependencyStates,
  calculateTaskDependencyState,
  DerivedDependencyState,
  PrerequisiteDetail,
  TaskDependencyState,
} from "@/lib/dag/taskState";
import { TaskNode } from "@/lib/dag/graph";

export interface TaskWithDependencies {
  _id: string;
  id: string;
  title: string;
  description?: string;
  status: string;
  startDate?: string | null;
  dueDate?: string | null;
  duration?: number;
  position?: number;
  dependencyIds: string[];
  dependencies?: {
    id: string;
    title: string;
    status: string;
  }[];
  // Calculated / Derived Dependency States
  dependencyState: DerivedDependencyState;
  isBlocked: boolean;
  isReady: boolean;
  blockingPrerequisites: PrerequisiteDetail[];
  completedPrerequisites: PrerequisiteDetail[];
  readinessPercentage: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transforms a raw Mongoose Task document into a normalized JSON-safe object
 * with computed dependency state.
 */
export function formatTaskResponse(
  task: any,
  computedState?: TaskDependencyState
): TaskWithDependencies {
  const isPopulated =
    Array.isArray(task.dependencyIds) &&
    task.dependencyIds.length > 0 &&
    typeof task.dependencyIds[0] === "object" &&
    task.dependencyIds[0] !== null &&
    "title" in task.dependencyIds[0];

  const rawDependencyIds: string[] = isPopulated
    ? task.dependencyIds.map((d: any) => d._id.toString())
    : (task.dependencyIds || []).map((d: any) =>
        typeof d === "string" ? d : d.toString()
      );

  const dependencies = isPopulated
    ? task.dependencyIds.map((d: any) => ({
        id: d._id.toString(),
        title: d.title,
        status: d.status,
      }))
    : undefined;

  const idStr = (task._id || task.id).toString();

  const isCompleted = task.status === "DONE";
  const defaultState: DerivedDependencyState = isCompleted ? "DONE" : "READY";

  return {
    _id: idStr,
    id: idStr,
    title: task.title,
    description: task.description || "",
    status: task.status,
    startDate: task.startDate ? new Date(task.startDate).toISOString() : null,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    duration: typeof task.duration === "number" ? task.duration : 1,
    position: typeof task.position === "number" ? task.position : 0,
    dependencyIds: rawDependencyIds,
    ...(dependencies ? { dependencies } : {}),
    // Attached derived states
    dependencyState: computedState?.dependencyState ?? defaultState,
    isBlocked: computedState?.isBlocked ?? false,
    isReady: computedState?.isReady ?? true,
    blockingPrerequisites: computedState?.blockingPrerequisites ?? [],
    completedPrerequisites: computedState?.completedPrerequisites ?? [],
    readinessPercentage: computedState?.readinessPercentage ?? 100,
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Retrieve all tasks from database with populated dependency metadata
 * and calculated dynamic dependency states (BLOCKED/READY/DONE).
 */
export async function getAllTasks(): Promise<TaskWithDependencies[]> {
  await connectToDatabase();

  const tasks = await Task.find({})
    .populate({
      path: "dependencyIds",
      select: "_id title status",
    })
    .sort({ position: 1, createdAt: 1 })
    .lean();

  const states = calculateAllDependencyStates(tasks as unknown as TaskNode[]);

  return tasks.map((t) => formatTaskResponse(t, states[t._id.toString()]));
}

/**
 * Retrieve a single task by its MongoDB ID with calculated dependency state.
 */
export async function getTaskById(id: string): Promise<TaskWithDependencies | null> {
  await connectToDatabase();

  const allTasks = await Task.find({}).lean();
  const task = await Task.findById(id)
    .populate({
      path: "dependencyIds",
      select: "_id title status",
    })
    .lean();

  if (!task) {
    return null;
  }

  const state = calculateTaskDependencyState(
    id,
    allTasks as unknown as TaskNode[]
  );

  return formatTaskResponse(task, state);
}

/**
 * Create a new task.
 */
export async function createTask(input: CreateTaskInput): Promise<TaskWithDependencies> {
  await connectToDatabase();

  const dependencyObjectIds = (input.dependencyIds || []).map(
    (depId) => new mongoose.Types.ObjectId(depId)
  );

  const taskDoc = await Task.create({
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "BACKLOG",
    startDate: input.startDate ?? undefined,
    dueDate: input.dueDate ?? undefined,
    duration: input.duration ?? 1,
    position: input.position ?? 0,
    dependencyIds: dependencyObjectIds,
  });

  const allTasks = await Task.find({}).lean();
  const populatedTask = await Task.findById(taskDoc._id)
    .populate({
      path: "dependencyIds",
      select: "_id title status",
    })
    .lean();

  const state = calculateTaskDependencyState(
    taskDoc._id.toString(),
    allTasks as unknown as TaskNode[]
  );

  return formatTaskResponse(populatedTask, state);
}

/**
 * Update an existing task by its ID and return updated task with fresh derived dependency state.
 */
export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<TaskWithDependencies | null> {
  await connectToDatabase();

  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.startDate !== undefined) updateData.startDate = input.startDate;
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
  if (input.duration !== undefined) updateData.duration = input.duration;
  if (input.position !== undefined) updateData.position = input.position;

  if (input.dependencyIds !== undefined) {
    updateData.dependencyIds = input.dependencyIds.map(
      (depId) => new mongoose.Types.ObjectId(depId)
    );
  }

  const updatedTask = await Task.findByIdAndUpdate(
    id,
    { $set: updateData },
    { returnDocument: "after", runValidators: true }
  )
    .populate({
      path: "dependencyIds",
      select: "_id title status",
    })
    .lean();

  if (!updatedTask) {
    return null;
  }

  const allTasks = await Task.find({}).lean();
  const state = calculateTaskDependencyState(
    id,
    allTasks as unknown as TaskNode[]
  );

  return formatTaskResponse(updatedTask, state);
}

/**
 * Delete a task and remove its ID from dependencyIds of any other tasks.
 */
export async function deleteTask(id: string): Promise<{
  deletedTask: TaskWithDependencies;
  unlinkedFromCount: number;
} | null> {
  await connectToDatabase();

  const targetObjectId = new mongoose.Types.ObjectId(id);

  // Check if task exists before deleting
  const existingTask = await Task.findById(targetObjectId).lean();
  if (!existingTask) {
    return null;
  }

  // Step 1: Remove its ID from dependencyIds of all other tasks that depend on it
  const updateResult = await Task.updateMany(
    { dependencyIds: targetObjectId },
    { $pull: { dependencyIds: targetObjectId } }
  );

  // Step 2: Delete the target task
  await Task.findByIdAndDelete(targetObjectId);

  return {
    deletedTask: formatTaskResponse(existingTask),
    unlinkedFromCount: updateResult.modifiedCount,
  };
}
