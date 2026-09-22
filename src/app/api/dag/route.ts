import { NextRequest, NextResponse } from "next/server";
import Task from "@/models/Task";
import { connectToDatabase } from "@/lib/db/connect";
import {
  calculateAllTaskStates,
  addDependency,
  removeDependency,
  getDownstreamTasks,
  getPrerequisiteTasks,
  DagValidationError,
  TaskNode,
} from "@/lib/dag";

/**
 * GET /api/dag
 * Returns the computed readiness states and dependency metrics for all tasks in the system.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const tasks = await Task.find({}).lean();
    const computedStates = calculateAllTaskStates(tasks as unknown as TaskNode[]);

    return NextResponse.json({
      success: true,
      data: computedStates,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate DAG state",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dag
 * Add or remove dependency edges between tasks with cycle detection and validation.
 *
 * Body:
 * - action: "add" | "remove"
 * - prerequisiteId: string
 * - dependentId: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, prerequisiteId, dependentId } = body;

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'action' must be either 'add' or 'remove'",
        },
        { status: 400 }
      );
    }

    if (!prerequisiteId || !dependentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Fields 'prerequisiteId' and 'dependentId' are required",
        },
        { status: 400 }
      );
    }

    if (action === "add") {
      const result = await addDependency(prerequisiteId, dependentId);
      return NextResponse.json({
        success: true,
        message: "Dependency added successfully",
        data: result,
      });
    } else {
      const result = await removeDependency(prerequisiteId, dependentId);
      return NextResponse.json({
        success: true,
        message: "Dependency removed successfully",
        data: result,
      });
    }
  } catch (error: unknown) {
    if (error instanceof DagValidationError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
        },
        { status: error.statusCode }
      );
    }

    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to perform DAG operation",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
