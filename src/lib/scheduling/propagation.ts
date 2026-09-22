import {
  TaskNode,
  buildDependencyGraph,
  getTransitiveDownstreamIds,
  normalizeId,
  topologicalSort,
} from "@/lib/dag/graph";

export interface ScheduleChangeImpact {
  taskId: string;
  title: string;
  originalStartDate: Date | null;
  newStartDate: Date | null;
  originalDueDate: Date | null;
  newDueDate: Date | null;
  deltaDays: number;
}

export interface PropagationResult<T extends TaskNode = TaskNode> {
  sourceTaskId: string;
  deltaDays: number;
  updatedTasks: T[];
  affectedTasks: ScheduleChangeImpact[];
  affectedTaskIds: string[];
  unaffectedTaskIds: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Shifts a Date by a given number of days while preserving the time component.
 */
export function shiftDateByDays(date: Date | string | null | undefined, deltaDays: number): Date | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + deltaDays * MS_PER_DAY);
}

/**
 * Deterministically propagates an upstream schedule change (in days) to all downstream tasks in a DAG.
 *
 * CRITICAL ANTI-COMPOUNDING GUARANTEE:
 * When an upstream task changes by +N days, every reachable downstream task moves by +N days EXACTLY ONCE,
 * even if there are multiple converging paths from the source (e.g. A -> B -> D and A -> C -> D).
 *
 * The algorithm:
 * 1. Builds the dependency graph.
 * 2. Identifies the full transitive downstream reachable set from sourceTaskId.
 * 3. Sorts affected tasks in topological order.
 * 4. Applies the single deltaDays shift to each reachable downstream task exactly once.
 * 5. Leaves all non-downstream / unrelated tasks completely unmodified.
 */
export function propagateScheduleChange<T extends TaskNode>(
  tasks: T[],
  sourceTaskIdInput: string,
  deltaDays: number
): PropagationResult<T> {
  const sourceTaskId = normalizeId(sourceTaskIdInput);
  const graph = buildDependencyGraph(tasks);

  if (deltaDays === 0) {
    return {
      sourceTaskId,
      deltaDays: 0,
      updatedTasks: [...tasks],
      affectedTasks: [],
      affectedTaskIds: [],
      unaffectedTaskIds: graph.allIds,
    };
  }

  // 1. Find all reachable downstream task IDs (transitive closure)
  const reachableDownstreamIds = new Set(
    getTransitiveDownstreamIds(graph, sourceTaskId)
  );

  const affectedTaskIds = Array.from(reachableDownstreamIds);
  const unaffectedTaskIds = graph.allIds.filter(
    (id) => id !== sourceTaskId && !reachableDownstreamIds.has(id)
  );

  const affectedMap = new Map<string, ScheduleChangeImpact>();

  // 2. Map through tasks and apply shift to source and reachable downstream tasks
  const updatedTasks = tasks.map((task) => {
    const id = normalizeId(task._id || task.id);

    // If task is the source or in reachable downstream set, shift its schedule
    if (id === sourceTaskId || reachableDownstreamIds.has(id)) {
      const originalStart = task.startDate ? new Date(task.startDate) : null;
      const originalDue = task.dueDate ? new Date(task.dueDate) : null;

      const newStart = shiftDateByDays(originalStart, deltaDays);
      const newDue = shiftDateByDays(originalDue, deltaDays);

      // Track impact (excluding the source itself from downstream impact list if needed, or including with tag)
      if (id !== sourceTaskId) {
        affectedMap.set(id, {
          taskId: id,
          title: task.title,
          originalStartDate: originalStart,
          newStartDate: newStart,
          originalDueDate: originalDue,
          newDueDate: newDue,
          deltaDays,
        });
      }

      return {
        ...task,
        startDate: newStart,
        dueDate: newDue,
      };
    }

    // Unrelated tasks are completely unchanged
    return { ...task };
  });

  return {
    sourceTaskId,
    deltaDays,
    updatedTasks,
    affectedTasks: Array.from(affectedMap.values()),
    affectedTaskIds,
    unaffectedTaskIds,
  };
}

/**
 * Calculates the delta in days between an original due date and a new due date.
 */
export function calculateDeltaDays(
  originalDate: Date | string | null | undefined,
  newDate: Date | string | null | undefined
): number {
  if (!originalDate || !newDate) return 0;
  const o = new Date(originalDate).getTime();
  const n = new Date(newDate).getTime();
  return Math.round((n - o) / MS_PER_DAY);
}
