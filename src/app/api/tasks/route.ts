import { NextRequest, NextResponse } from "next/server";
import {
  getAllTasks,
  createTask,
} from "@/lib/services/taskService";
import { validateCreateTaskInput } from "@/lib/validations/task";

/**
 * GET /api/tasks
 * Returns all tasks along with dependency information.
 */
export async function GET() {
  try {
    const tasks = await getAllTasks();

    return NextResponse.json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error occurred";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve tasks",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Validates input (title, dates, duration, etc.) and creates a new task.
 */
export async function POST(request: NextRequest) {
  try {
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

    const validation = validateCreateTaskInput(body);
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

    const newTask = await createTask(validation.data);

    return NextResponse.json(
      {
        success: true,
        message: "Task created successfully",
        data: newTask,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error occurred";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create task",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
