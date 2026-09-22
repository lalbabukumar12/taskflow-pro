import { Types } from "mongoose";
import {
  TaskNode,
  DependencyGraph,
  buildDependencyGraph,
  normalizeId,
} from "./graph";

export type DerivedDependencyState = "READY" | "BLOCKED" | "DONE";

export interface PrerequisiteDetail {
  id: string;
  title: string;
  status: string;
}

export interface TaskDependencyState {
  taskId: string;
  workflowStatus: string;
  dependencyState: DerivedDependencyState;
  isBlocked: boolean;
  isReady: boolean;
  isCompleted: boolean;
  totalPrerequisites: number;
  completedPrerequisitesCount: number;
  readinessPercentage: number;
  blockingPrerequisiteIds: string[];
  blockingPrerequisites: PrerequisiteDetail[];
  completedPrerequisiteIds: string[];
  completedPrerequisites: PrerequisiteDetail[];
}

export interface TaskWithDependencyState extends Record<string, any> {
  dependencyState: DerivedDependencyState;
  isBlocked: boolean;
  isReady: boolean;
  blockingPrerequisites: PrerequisiteDetail[];
  completedPrerequisites: PrerequisiteDetail[];
  readinessPercentage: number;
}

/**
 * Calculates the derived dependency state (BLOCKED, READY, or DONE) for a single task.
 *
 * Rules:
 * - A task is BLOCKED if at least one prerequisite is not DONE.
 * - A task is READY if all prerequisites are DONE (or if it has 0 prerequisites).
 * - A task whose workflow status is DONE is marked as DONE.
 * - Dynamic state updates automatically if a prerequisite rolls back from DONE to IN_PROGRESS.
 */
export function calculateTaskDependencyState(
  taskIdInput: string | Types.ObjectId,
  tasksOrGraph: TaskNode[] | DependencyGraph
): TaskDependencyState {
  const taskId = normalizeId(taskIdInput);
  const graph = Array.isArray(tasksOrGraph)
    ? buildDependencyGraph(tasksOrGraph)
    : tasksOrGraph;

  const node = graph.nodes.get(taskId);
  const workflowStatus = node?.status || "BACKLOG";
  const isCompleted = workflowStatus === "DONE";

  const prereqIds = graph.prerequisites.get(taskId) || new Set<string>();
  const totalPrerequisites = prereqIds.size;

  const blockingPrerequisites: PrerequisiteDetail[] = [];
  const blockingPrerequisiteIds: string[] = [];
  const completedPrerequisites: PrerequisiteDetail[] = [];
  const completedPrerequisiteIds: string[] = [];

  for (const prereqId of prereqIds) {
    const prereqNode = graph.nodes.get(prereqId);
    const title = prereqNode?.title || "Unknown Task";
    const status = prereqNode?.status || "BACKLOG";

    if (status === "DONE") {
      completedPrerequisites.push({ id: prereqId, title, status });
      completedPrerequisiteIds.push(prereqId);
    } else {
      blockingPrerequisites.push({ id: prereqId, title, status });
      blockingPrerequisiteIds.push(prereqId);
    }
  }

  const isBlocked = blockingPrerequisites.length > 0;
  const isReady = !isBlocked;

  let dependencyState: DerivedDependencyState;
  if (isCompleted) {
    dependencyState = "DONE";
  } else if (isBlocked) {
    dependencyState = "BLOCKED";
  } else {
    dependencyState = "READY";
  }

  const completedPrerequisitesCount = completedPrerequisites.length;
  const readinessPercentage =
    totalPrerequisites === 0
      ? 100
      : Math.round((completedPrerequisitesCount / totalPrerequisites) * 100);

  return {
    taskId,
    workflowStatus,
    dependencyState,
    isBlocked,
    isReady,
    isCompleted,
    totalPrerequisites,
    completedPrerequisitesCount,
    readinessPercentage,
    blockingPrerequisiteIds,
    blockingPrerequisites,
    completedPrerequisiteIds,
    completedPrerequisites,
  };
}

/**
 * Calculates derived dependency states for all tasks in the provided collection.
 */
export function calculateAllDependencyStates(
  tasks: TaskNode[]
): Record<string, TaskDependencyState> {
  const graph = buildDependencyGraph(tasks);
  const result: Record<string, TaskDependencyState> = {};

  for (const taskId of graph.allIds) {
    result[taskId] = calculateTaskDependencyState(taskId, graph);
  }

  return result;
}

/**
 * Decorates task objects with their calculated dependency states.
 */
export function attachDependencyStatesToTasks<T extends TaskNode>(
  tasks: T[]
): (T & TaskWithDependencyState)[] {
  const states = calculateAllDependencyStates(tasks);

  return tasks.map((task) => {
    const id = normalizeId(task._id || task.id);
    const state = states[id] || {
      dependencyState: task.status === "DONE" ? "DONE" : "READY",
      isBlocked: false,
      isReady: true,
      blockingPrerequisites: [],
      completedPrerequisites: [],
      readinessPercentage: 100,
    };

    return {
      ...task,
      dependencyState: state.dependencyState,
      isBlocked: state.isBlocked,
      isReady: state.isReady,
      blockingPrerequisites: state.blockingPrerequisites,
      completedPrerequisites: state.completedPrerequisites,
      readinessPercentage: state.readinessPercentage,
    };
  });
}
