import mongoose from "mongoose";
import { TASK_STATUSES, TaskStatus } from "@/models/Task";

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  startDate?: string | Date;
  dueDate?: string | Date;
  duration?: number;
  dependencyIds?: string[];
  position?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  duration?: number;
  dependencyIds?: string[];
  position?: number;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  data?: T;
}

export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
}

export function validateCreateTaskInput(body: unknown): ValidationResult<CreateTaskInput> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { isValid: false, errors: ["Request body must be a JSON object"] };
  }

  const raw = body as Record<string, unknown>;

  // Title validation
  if (typeof raw.title !== "string" || !raw.title.trim()) {
    errors.push("Task 'title' is required and must be a non-empty string");
  } else if (raw.title.trim().length > 180) {
    errors.push("Task 'title' cannot exceed 180 characters");
  }

  // Description validation
  if (raw.description !== undefined && typeof raw.description !== "string") {
    errors.push("Task 'description' must be a string if provided");
  }

  // Status validation
  if (raw.status !== undefined) {
    if (typeof raw.status !== "string" || !TASK_STATUSES.includes(raw.status as TaskStatus)) {
      errors.push(
        `Task 'status' must be one of: ${TASK_STATUSES.join(", ")}`
      );
    }
  }

  // Date parsing and validation
  let parsedStartDate: Date | undefined;
  if (raw.startDate !== undefined && raw.startDate !== null && raw.startDate !== "") {
    const d = new Date(raw.startDate as string);
    if (Number.isNaN(d.getTime())) {
      errors.push("Task 'startDate' must be a valid ISO date");
    } else {
      parsedStartDate = d;
    }
  }

  let parsedDueDate: Date | undefined;
  if (raw.dueDate !== undefined && raw.dueDate !== null && raw.dueDate !== "") {
    const d = new Date(raw.dueDate as string);
    if (Number.isNaN(d.getTime())) {
      errors.push("Task 'dueDate' must be a valid ISO date");
    } else {
      parsedDueDate = d;
    }
  }

  if (parsedStartDate && parsedDueDate && parsedStartDate > parsedDueDate) {
    errors.push("Task 'startDate' cannot be after 'dueDate'");
  }

  // Duration validation
  if (raw.duration !== undefined && raw.duration !== null) {
    if (typeof raw.duration !== "number" || raw.duration < 0 || Number.isNaN(raw.duration)) {
      errors.push("Task 'duration' must be a non-negative number");
    }
  }

  // Position validation
  if (raw.position !== undefined && raw.position !== null) {
    if (typeof raw.position !== "number" || raw.position < 0 || Number.isNaN(raw.position)) {
      errors.push("Task 'position' must be a non-negative number");
    }
  }

  // Dependency IDs validation
  let validatedDependencyIds: string[] | undefined;
  if (raw.dependencyIds !== undefined && raw.dependencyIds !== null) {
    if (!Array.isArray(raw.dependencyIds)) {
      errors.push("Task 'dependencyIds' must be an array of MongoDB ObjectIds");
    } else {
      const invalidIds = raw.dependencyIds.filter(
        (id) => typeof id !== "string" || !isValidObjectId(id)
      );
      if (invalidIds.length > 0) {
        errors.push(
          `Invalid MongoDB ObjectId(s) found in dependencyIds: ${invalidIds.join(", ")}`
        );
      } else {
        // Unique dependency IDs
        validatedDependencyIds = Array.from(new Set(raw.dependencyIds as string[]));
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      title: (raw.title as string).trim(),
      description: typeof raw.description === "string" ? raw.description.trim() : "",
      status: (raw.status as TaskStatus) || "BACKLOG",
      startDate: parsedStartDate,
      dueDate: parsedDueDate,
      duration: typeof raw.duration === "number" ? raw.duration : 1,
      dependencyIds: validatedDependencyIds || [],
      position: typeof raw.position === "number" ? raw.position : 0,
    },
  };
}

export function validateUpdateTaskInput(body: unknown): ValidationResult<UpdateTaskInput> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { isValid: false, errors: ["Request body must be a JSON object"] };
  }

  const raw = body as Record<string, unknown>;
  const allowedFields = [
    "title",
    "description",
    "status",
    "startDate",
    "dueDate",
    "duration",
    "dependencyIds",
    "position",
  ];

  const providedKeys = Object.keys(raw);
  if (providedKeys.length === 0) {
    return {
      isValid: false,
      errors: ["At least one field must be provided to update"],
    };
  }

  const data: UpdateTaskInput = {};

  // Title validation
  if (raw.title !== undefined) {
    if (typeof raw.title !== "string" || !raw.title.trim()) {
      errors.push("Task 'title' cannot be empty");
    } else if (raw.title.trim().length > 180) {
      errors.push("Task 'title' cannot exceed 180 characters");
    } else {
      data.title = raw.title.trim();
    }
  }

  // Description validation
  if (raw.description !== undefined) {
    if (typeof raw.description !== "string") {
      errors.push("Task 'description' must be a string");
    } else {
      data.description = raw.description.trim();
    }
  }

  // Status validation
  if (raw.status !== undefined) {
    if (typeof raw.status !== "string" || !TASK_STATUSES.includes(raw.status as TaskStatus)) {
      errors.push(
        `Task 'status' must be one of: ${TASK_STATUSES.join(", ")}`
      );
    } else {
      data.status = raw.status as TaskStatus;
    }
  }

  // Date parsing and validation
  let parsedStartDate: Date | null | undefined;
  if (raw.startDate !== undefined) {
    if (raw.startDate === null || raw.startDate === "") {
      data.startDate = null;
    } else {
      const d = new Date(raw.startDate as string);
      if (Number.isNaN(d.getTime())) {
        errors.push("Task 'startDate' must be a valid ISO date or null");
      } else {
        parsedStartDate = d;
        data.startDate = d;
      }
    }
  }

  let parsedDueDate: Date | null | undefined;
  if (raw.dueDate !== undefined) {
    if (raw.dueDate === null || raw.dueDate === "") {
      data.dueDate = null;
    } else {
      const d = new Date(raw.dueDate as string);
      if (Number.isNaN(d.getTime())) {
        errors.push("Task 'dueDate' must be a valid ISO date or null");
      } else {
        parsedDueDate = d;
        data.dueDate = d;
      }
    }
  }

  if (parsedStartDate && parsedDueDate && parsedStartDate > parsedDueDate) {
    errors.push("Task 'startDate' cannot be after 'dueDate'");
  }

  // Duration validation
  if (raw.duration !== undefined) {
    if (typeof raw.duration !== "number" || raw.duration < 0 || Number.isNaN(raw.duration)) {
      errors.push("Task 'duration' must be a non-negative number");
    } else {
      data.duration = raw.duration;
    }
  }

  // Position validation
  if (raw.position !== undefined) {
    if (typeof raw.position !== "number" || raw.position < 0 || Number.isNaN(raw.position)) {
      errors.push("Task 'position' must be a non-negative number");
    } else {
      data.position = raw.position;
    }
  }

  // Dependency IDs validation
  if (raw.dependencyIds !== undefined) {
    if (!Array.isArray(raw.dependencyIds)) {
      errors.push("Task 'dependencyIds' must be an array of MongoDB ObjectIds");
    } else {
      const invalidIds = raw.dependencyIds.filter(
        (id) => typeof id !== "string" || !isValidObjectId(id)
      );
      if (invalidIds.length > 0) {
        errors.push(
          `Invalid MongoDB ObjectId(s) found in dependencyIds: ${invalidIds.join(", ")}`
        );
      } else {
        data.dependencyIds = Array.from(new Set(raw.dependencyIds as string[]));
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data,
  };
}
