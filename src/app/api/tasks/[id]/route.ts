import { NextRequest, NextResponse } from "next/server";
import {
  getTaskById,
  updateTask,
  deleteTask,
} from "@/lib/services/taskService";
import {
  isValidObjectId,
  validateUpdateTaskInput,
} from "@/lib/validations/task";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]
 * Retrieves a single task by its MongoDB ID with dependency information.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid MongoDB ObjectId format",
        },
        { status: 400 }
      );
    }

    const task = await getTaskById(id);

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: `Task with id '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: task,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error occurred";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve task",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tasks/[id]
 * Updates fields (title, description, status, dates, duration, position, dependencyIds) of an existing task.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid MongoDB ObjectId format",
        },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON format in request body",
        },
        { status: 400 }
      );
    }

    const validation = validateUpdateTaskInput(body);
    if (!validation.isValid || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const updatedTask = await updateTask(id, validation.data);

    if (!updatedTask) {
      return NextResponse.json(
        {
          success: false,
          error: `Task with id '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error occurred";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update task",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]
 * Deletes a task and removes its ID from dependencyIds of any dependent tasks.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid MongoDB ObjectId format",
        },
        { status: 400 }
      );
    }

    const result = await deleteTask(id);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: `Task with id '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully and unlinked from dependent tasks",
      data: result.deletedTask,
      unlinkedDependenciesCount: result.unlinkedFromCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error occurred";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete task",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
