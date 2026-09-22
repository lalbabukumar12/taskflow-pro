import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISettings {
  workspaceName: string;
  workspaceDescription: string;
  theme: "dark" | "light" | "system";
  layoutPreference: "compact" | "comfortable";
  defaultTaskStatus: "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE";
  defaultTaskDuration: number;
  updatedAt: Date;
}

export interface ISettingsDocument extends Document {
  workspaceName: string;
  workspaceDescription: string;
  theme: "dark" | "light" | "system";
  layoutPreference: "compact" | "comfortable";
  defaultTaskStatus: "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE";
  defaultTaskDuration: number;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettingsDocument>(
  {
    workspaceName: {
      type: String,
      default: "Engineering Core Workspace",
      trim: true,
      maxlength: 100,
    },
    workspaceDescription: {
      type: String,
      default: "Mission-critical DAG project pipeline and dependency orchestration.",
      trim: true,
      maxlength: 300,
    },
    theme: {
      type: String,
      enum: ["dark", "light", "system"],
      default: "dark",
    },
    layoutPreference: {
      type: String,
      enum: ["compact", "comfortable"],
      default: "comfortable",
    },
    defaultTaskStatus: {
      type: String,
      enum: ["BACKLOG", "IN_PROGRESS", "REVIEW", "DONE"],
      default: "BACKLOG",
    },
    defaultTaskDuration: {
      type: Number,
      default: 3,
      min: 1,
      max: 365,
    },
  },
  {
    timestamps: true,
  }
);

const Settings: Model<ISettingsDocument> =
  mongoose.models.Settings || mongoose.model<ISettingsDocument>("Settings", SettingsSchema);

export default Settings;
