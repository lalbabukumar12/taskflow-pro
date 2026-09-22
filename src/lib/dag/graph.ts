import { Types } from "mongoose";

export interface TaskNode {
  _id?: string | Types.ObjectId;
  id?: string;
  title: string;
  status: string; // 'BACKLOG' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  dependencyIds?: (string | Types.ObjectId)[];
  [key: string]: any;
}

export interface DependencyGraph {
  /** Map of taskId -> TaskNode */
  nodes: Map<string, TaskNode>;
  /** Map of taskId -> Set of prerequisite taskIds (tasks that this task depends ON: prerequisites) */
  prerequisites: Map<string, Set<string>>;
  /** Map of taskId -> Set of downstream taskIds (tasks that DEPEND ON this task: dependents) */
  downstream: Map<string, Set<string>>;
  /** All task IDs in the graph */
  allIds: string[];
}

/**
 * Normalizes an ObjectId or string into a clean string ID.
 */
export function normalizeId(id: string | Types.ObjectId | undefined | null): string {
  if (!id) return "";
  return typeof id === "string" ? id : id.toString();
}

/**
 * Builds bidirectional adjacency maps for the dependency graph:
 * - `prerequisites`: map of taskId -> direct prerequisites
 * - `downstream`: map of taskId -> direct dependents (downstream consumers)
 */
export function buildDependencyGraph(tasks: TaskNode[]): DependencyGraph {
  const nodes = new Map<string, TaskNode>();
  const prerequisites = new Map<string, Set<string>>();
  const downstream = new Map<string, Set<string>>();
  const allIds: string[] = [];

  // Pass 1: Initialize all node slots
  for (const task of tasks) {
    const taskId = normalizeId(task._id || task.id);
    if (!taskId) continue;

    nodes.set(taskId, task);
    prerequisites.set(taskId, new Set<string>());
    downstream.set(taskId, new Set<string>());
    allIds.push(taskId);
  }

  // Pass 2: Populate prerequisite and downstream connections
  for (const task of tasks) {
    const dependentId = normalizeId(task._id || task.id);
    if (!dependentId) continue;

    const rawDeps = task.dependencyIds || [];
    for (const rawDep of rawDeps) {
      const prerequisiteId = normalizeId(
        typeof rawDep === "object" && rawDep !== null && "_id" in rawDep
          ? (rawDep as any)._id
          : rawDep
      );

      if (!prerequisiteId) continue;

      // Register prerequisite for dependentId
      if (prerequisites.has(dependentId)) {
        prerequisites.get(dependentId)!.add(prerequisiteId);
      }

      // Register downstream dependent for prerequisiteId
      if (downstream.has(prerequisiteId)) {
        downstream.get(prerequisiteId)!.add(dependentId);
      } else {
        // In case prerequisiteId wasn't in the initial nodes list
        const set = new Set<string>();
        set.add(dependentId);
        downstream.set(prerequisiteId, set);
      }
    }
  }

  return {
    nodes,
    prerequisites,
    downstream,
    allIds,
  };
}

/**
 * Determines if adding a directed edge (prerequisiteId -> dependentId) would introduce a cycle.
 *
 * Edge semantics:
 * dependentId DEPENDS ON prerequisiteId (prerequisiteId -> dependentId).
 *
 * A cycle is introduced if:
 * 1. prerequisiteId === dependentId (self-dependency)
 * 2. There is already an existing path from dependentId to prerequisiteId (i.e. prerequisiteId is reachable downstream from dependentId).
 */
export function wouldCreateCycle(
  tasks: TaskNode[],
  prerequisiteIdInput: string | Types.ObjectId,
  dependentIdInput: string | Types.ObjectId
): boolean {
  const prereqId = normalizeId(prerequisiteIdInput);
  const depId = normalizeId(dependentIdInput);

  // Rule 1: Self dependency is inherently a cycle of length 1
  if (!prereqId || !depId || prereqId === depId) {
    return true;
  }

  const graph = buildDependencyGraph(tasks);

  // If adding prereqId -> depId:
  // Check if prereqId is reachable by traversing downstream edges starting at depId.
  // If depId can reach prereqId, then adding prereqId -> depId creates a cycle: depId -> ... -> prereqId -> depId.
  const visited = new Set<string>();
  const queue: string[] = [depId];
  visited.add(depId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === prereqId) {
      return true;
    }

    const downstreamNeighbors = graph.downstream.get(current);
    if (downstreamNeighbors) {
      for (const nextId of downstreamNeighbors) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
        }
      }
    }
  }

  return false;
}

/**
 * Returns all transitive downstream tasks (tasks that directly or indirectly depend on taskId).
 */
export function getTransitiveDownstreamIds(
  graph: DependencyGraph,
  taskIdInput: string | Types.ObjectId
): string[] {
  const taskId = normalizeId(taskIdInput);
  const result: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  const initialDirect = graph.downstream.get(taskId);
  if (initialDirect) {
    for (const id of initialDirect) {
      visited.add(id);
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const nextDirect = graph.downstream.get(current);
    if (nextDirect) {
      for (const nextId of nextDirect) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
        }
      }
    }
  }

  return result;
}

/**
 * Returns all transitive prerequisite tasks (tasks that taskId directly or indirectly depends on).
 */
export function getTransitivePrerequisiteIds(
  graph: DependencyGraph,
  taskIdInput: string | Types.ObjectId
): string[] {
  const taskId = normalizeId(taskIdInput);
  const result: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  const initialDirect = graph.prerequisites.get(taskId);
  if (initialDirect) {
    for (const id of initialDirect) {
      visited.add(id);
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const nextDirect = graph.prerequisites.get(current);
    if (nextDirect) {
      for (const nextId of nextDirect) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
        }
      }
    }
  }

  return result;
}

/**
 * Returns a topological sort of task IDs in the graph.
 * Throws an error if a cycle exists in the provided tasks.
 */
export function topologicalSort(tasks: TaskNode[]): string[] {
  const graph = buildDependencyGraph(tasks);
  const inDegree = new Map<string, number>();

  for (const id of graph.allIds) {
    const prereqs = graph.prerequisites.get(id);
    inDegree.set(id, prereqs ? prereqs.size : 0);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const downstream = graph.downstream.get(current);
    if (downstream) {
      for (const nextId of downstream) {
        const newDeg = (inDegree.get(nextId) || 0) - 1;
        inDegree.set(nextId, newDeg);
        if (newDeg === 0) {
          queue.push(nextId);
        }
      }
    }
  }

  if (sorted.length !== graph.allIds.length) {
    throw new Error("Graph contains a cycle; topological sort cannot be completed");
  }

  return sorted;
}
