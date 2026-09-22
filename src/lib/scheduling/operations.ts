import mongoose, { Types } from "mongoose";
import Task from "@/models/Task";
import { connectToDatabase } from "@/lib/db/connect";
import { isValidObjectId } from "@/lib/validations/task";
import { TaskNode, normalizeId } from "@/lib/dag/graph";
import {
  propagateScheduleChange,
  PropagationResult,
  ScheduleChangeImpact,
} from "./propagation";
import { formatTaskResponse, TaskWithDependencies } from "@/lib/services/taskService";

/**
 * Previews the downstream schedule impact of shifting a task without modifying the database.
 */
export async function previewScheduleImpact(
  sourceTaskIdInput: string | Types.ObjectId,
  deltaDays: number
): Promise<{
  sourceTaskId: string;
  sourceTaskTitle: string;
  deltaDays: number;
  affectedTasks: ScheduleChangeImpact[];
  totalAffectedCount: number;
}> {
  await connectToDatabase();

  const sourceTaskId = normalizeId(sourceTaskIdInput);
  if (!isValidObjectId(sourceTaskId)) {
    throw new Error(`Invalid source task ID: ${sourceTaskId}`);
  }

  const allTasks = await Task.find({}).lean();
  const sourceTask = allTasks.find((t) => t._id.toString() === sourceTaskId);

  if (!sourceTask) {
    throw new Error(`Task with id '${sourceTaskId}' not found`);
  }

  const propagation = propagateScheduleChange(
    allTasks as unknown as TaskNode[],
    sourceTaskId,
    deltaDays
  );

  return {
    sourceTaskId,
    sourceTaskTitle: sourceTask.title,
    deltaDays,
    affectedTasks: propagation.affectedTasks,
    totalAffectedCount: propagation.affectedTasks.length,
  };
}

/**
 * Persists an upstream schedule change and propagates date shifts to all downstream tasks in MongoDB.
 * Ensures the anti-compounding guarantee where every affected downstream task is shifted by deltaDays exactly once.
 */
export async function applySchedulePropagation(
  sourceTaskIdInput: string | Types.ObjectId,
  deltaDays: number
): Promise<{
  sourceTask: TaskWithDependencies;
  affectedTasks: ScheduleChangeImpact[];
  totalUpdatedCount: number;
}> {
  await connectToDatabase();

  const sourceTaskId = normalizeId(sourceTaskIdInput);
  if (!isValidObjectId(sourceTaskId)) {
    throw new Error(`Invalid source task ID: ${sourceTaskId}`);
  }

  const allTasks = await Task.find({}).lean();
  const sourceTask = allTasks.find((t) => t._id.toString() === sourceTaskId);

  if (!sourceTask) {
    throw new Error(`Task with id '${sourceTaskId}' not found`);
  }

  const propagation = propagateScheduleChange(
    allTasks as unknown as TaskNode[],
    sourceTaskId,
    deltaDays
  );

  // Perform atomic bulk write in MongoDB to update source and all affected downstream tasks
  const bulkOps = propagation.updatedTasks
    .filter((task) => {
      const id = normalizeId(task._id || task.id);
      return id === sourceTaskId || propagation.affectedTaskIds.includes(id);
    })
    .map((task) => {
      const id = normalizeId(task._id || task.id);
      const setObj: Record<string, any> = {};
      if (task.startDate) setObj.startDate = new Date(task.startDate);
      if (task.dueDate) setObj.dueDate = new Date(task.dueDate);

      return {
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(id) },
          update: {
            $set: setObj,
          },
        },
      };
    });

  if (bulkOps.length > 0) {
    await Task.bulkWrite(bulkOps as any);
  }

  const updatedSource = await Task.findById(sourceTaskId)
    .populate({
      path: "dependencyIds",
      select: "_id title status",
    })
    .lean();

  return {
    sourceTask: formatTaskResponse(updatedSource),
    affectedTasks: propagation.affectedTasks,
    totalUpdatedCount: bulkOps.length,
  };
}
