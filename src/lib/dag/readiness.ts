import { Types } from "mongoose";
import {
  TaskNode,
  DependencyGraph,
  buildDependencyGraph,
  normalizeId,
  getTransitiveDownstreamIds,
  getTransitivePrerequisiteIds,
} from "./graph";

export type ComputedReadiness = "BLOCKED" | "READY" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export interface TaskReadinessDetail {
  taskId: string;
  workflowStatus: string;
  computedReadiness: ComputedReadiness;
  isBlocked: boolean;
  isReady: boolean;
  totalPrerequisites: number;
  completedPrerequisitesCount: number;
  readinessPercentage: number;
  blockingPrerequisites: {
    id: string;
    title: string;
    status: string;
  }[];
  completedPrerequisites: {
    id: string;
    title: string;
    status: string;
  }[];
  directDownstreamCount: number;
  transitiveDownstreamCount: number;
}

export interface ComputedTaskStateMap {
  [taskId: string]: TaskReadinessDetail;
}

/**
 * Calculates the dynamic readiness state of a single task against the given graph or task set.
 */
export function calculateTaskReadiness(
  taskIdInput: string | Types.ObjectId,
  tasksOrGraph: TaskNode[] | DependencyGraph
): TaskReadinessDetail {
  const taskId = normalizeId(taskIdInput);
  const graph = Array.isArray(tasksOrGraph)
    ? buildDependencyGraph(tasksOrGraph)
    : tasksOrGraph;

  const node = graph.nodes.get(taskId);
  const workflowStatus = node?.status || "BACKLOG";

  const prereqIds = graph.prerequisites.get(taskId) || new Set<string>();
  const totalPrerequisites = prereqIds.size;

  const blockingPrerequisites: { id: string; title: string; status: string }[] = [];
  const completedPrerequisites: { id: string; title: string; status: string }[] = [];

  for (const prereqId of prereqIds) {
    const prereqNode = graph.nodes.get(prereqId);
    const title = prereqNode?.title || "Unknown Task";
    const status = prereqNode?.status || "BACKLOG";

    if (status === "DONE") {
      completedPrerequisites.push({ id: prereqId, title, status });
    } else {
      blockingPrerequisites.push({ id: prereqId, title, status });
    }
  }

  const isBlocked = blockingPrerequisites.length > 0;
  const isReady = !isBlocked;

  let computedReadiness: ComputedReadiness;
  if (workflowStatus === "DONE") {
    computedReadiness = "DONE";
  } else if (isBlocked) {
    computedReadiness = "BLOCKED";
  } else if (workflowStatus === "IN_PROGRESS") {
    computedReadiness = "IN_PROGRESS";
  } else if (workflowStatus === "REVIEW") {
    computedReadiness = "IN_REVIEW";
  } else {
    computedReadiness = "READY";
  }

  const completedPrerequisitesCount = completedPrerequisites.length;
  const readinessPercentage =
    totalPrerequisites === 0
      ? 100
      : Math.round((completedPrerequisitesCount / totalPrerequisites) * 100);

  const directDownstream = graph.downstream.get(taskId)?.size || 0;
  const transitiveDownstream = getTransitiveDownstreamIds(graph, taskId).length;

  return {
    taskId,
    workflowStatus,
    computedReadiness,
    isBlocked,
    isReady,
    totalPrerequisites,
    completedPrerequisitesCount,
    readinessPercentage,
    blockingPrerequisites,
    completedPrerequisites,
    directDownstreamCount: directDownstream,
    transitiveDownstreamCount: transitiveDownstream,
  };
}

/**
 * Calculates the dynamic readiness state for every task in the provided task collection.
 */
export function calculateAllTaskStates(tasks: TaskNode[]): ComputedTaskStateMap {
  const graph = buildDependencyGraph(tasks);
  const result: ComputedTaskStateMap = {};

  for (const taskId of graph.allIds) {
    result[taskId] = calculateTaskReadiness(taskId, graph);
  }

  return result;
}
