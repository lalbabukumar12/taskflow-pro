import { TaskNode, buildDependencyGraph, topologicalSort, normalizeId } from "./graph";

export interface TaskWithDuration extends TaskNode {
  duration?: number;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface CriticalPathResult {
  totalDuration: number;
  criticalTaskIds: string[];
  criticalEdgeKeys: Set<string>; // Set of "prerequisiteId->dependentId"
  criticalTasksSequence: string[]; // Array of task titles in order
}

/**
 * Calculates the Critical Path of a project's DAG.
 * The Critical Path is the longest chain of dependent tasks measured by duration.
 *
 * It uses dynamic programming over the topological ordering of the DAG.
 *
 * For any node v:
 * LongestPath(v) = duration(v) + max({ LongestPath(u) for all u in prerequisites(v) } U {0})
 */
export function calculateCriticalPath(tasks: TaskWithDuration[]): CriticalPathResult {
  if (!tasks || tasks.length === 0) {
    return {
      totalDuration: 0,
      criticalTaskIds: [],
      criticalEdgeKeys: new Set(),
      criticalTasksSequence: [],
    };
  }

  const graph = buildDependencyGraph(tasks);
  const topoOrder = topologicalSort(tasks);

  // Map task duration (default to 1 day if not specified or < 1)
  const durationMap = new Map<string, number>();
  const taskMap = new Map<string, TaskWithDuration>();

  for (const t of tasks) {
    const id = normalizeId(t.id || (t as any)._id);
    let dur = typeof t.duration === "number" && t.duration > 0 ? t.duration : 1;
    durationMap.set(id, dur);
    taskMap.set(id, t);
  }

  // dist[v] = maximum cumulative duration to complete task v including its prerequisites
  const dist = new Map<string, number>();
  const predecessor = new Map<string, string | null>();

  // Process nodes in topological order
  for (const nodeId of topoOrder) {
    const nodeDuration = durationMap.get(nodeId) || 1;
    const prereqs = graph.prerequisites.get(nodeId);

    if (!prereqs || prereqs.size === 0) {
      dist.set(nodeId, nodeDuration);
      predecessor.set(nodeId, null);
    } else {
      let maxPrereqDist = 0;
      let bestPrereq: string | null = null;

      for (const pId of prereqs) {
        const pDist = dist.get(pId) || 0;
        if (pDist > maxPrereqDist) {
          maxPrereqDist = pDist;
          bestPrereq = pId;
        }
      }

      dist.set(nodeId, maxPrereqDist + nodeDuration);
      predecessor.set(nodeId, bestPrereq);
    }
  }

  // Find the node with the maximum cumulative duration
  let maxTotalDuration = 0;
  let endNode: string | null = null;

  for (const [nodeId, totalDist] of dist.entries()) {
    if (totalDist > maxTotalDuration) {
      maxTotalDuration = totalDist;
      endNode = nodeId;
    }
  }

  if (!endNode) {
    return {
      totalDuration: 0,
      criticalTaskIds: [],
      criticalEdgeKeys: new Set(),
      criticalTasksSequence: [],
    };
  }

  // Backtrack from endNode to reconstruct critical path
  const criticalPathIds: string[] = [];
  let curr: string | null = endNode;

  while (curr) {
    criticalPathIds.unshift(curr);
    curr = predecessor.get(curr) || null;
  }

  // Build edge keys "prereqId->depId"
  const criticalEdgeKeys = new Set<string>();
  for (let i = 0; i < criticalPathIds.length - 1; i++) {
    const pId = criticalPathIds[i];
    const dId = criticalPathIds[i + 1];
    criticalEdgeKeys.add(`${pId}->${dId}`);
  }

  const criticalTasksSequence = criticalPathIds.map((id) => taskMap.get(id)?.title || id);

  return {
    totalDuration: maxTotalDuration,
    criticalTaskIds: criticalPathIds,
    criticalEdgeKeys,
    criticalTasksSequence,
  };
}
