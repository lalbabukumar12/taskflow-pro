import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type TaskStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE";

export const TASK_STATUSES: TaskStatus[] = [
  "BACKLOG",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

export interface ITask {
  title: string;
  description?: string;
  status: TaskStatus;
  startDate?: Date;
  dueDate?: Date;
  duration?: number;
  dependencyIds: Types.ObjectId[];
  position?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITaskDocument extends Document {
  title: string;
  description?: string;
  status: TaskStatus;
  startDate?: Date;
  dueDate?: Date;
  duration?: number;
  dependencyIds: Types.ObjectId[];
  position?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITaskDocument>(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [180, "Task title cannot exceed 180 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES,
        message: "{VALUE} is not a valid workflow status",
      },
      default: "BACKLOG",
      index: true,
    },
    startDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    duration: {
      type: Number,
      default: 1,
      min: [0, "Duration cannot be negative"],
    },
    dependencyIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Task",
        default: [],
      },
    ],
    position: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful indexes for dependency graph traversals and column ordering
TaskSchema.index({ dependencyIds: 1 });
TaskSchema.index({ status: 1, position: 1 });

// Prevent model overwrite during Next.js hot-reloading
const Task: Model<ITaskDocument> =
  mongoose.models.Task || mongoose.model<ITaskDocument>("Task", TaskSchema);

export default Task;
