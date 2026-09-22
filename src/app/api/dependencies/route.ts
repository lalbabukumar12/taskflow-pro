import { NextRequest, NextResponse } from "next/server";
import {
  addDependency,
  removeDependency,
  DagValidationError,
} from "@/lib/dag";

interface DependencyRequestBody {
  prerequisiteId?: string;
  dependentId?: string;
}

/**
 * POST /api/dependencies
 * Creates a new directed dependency edge: prerequisiteId -> dependentId
 *
 * Enforces:
 * 1. Validates both tasks exist.
 * 2. Rejects self dependency (prerequisiteId === dependentId).
 * 3. Rejects duplicate dependency.
 * 4. Runs cycle detection on the graph.
 * 5. Rejects the operation if a cycle would be created.
 * 6. Only saves if the graph remains a valid DAG.
 * 7. Recalculates affected task readiness and dependency states.
 */
export async function POST(request: NextRequest) {
  try {
    let body: DependencyRequestBody;
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

    const { prerequisiteId, dependentId } = body;

    if (!prerequisiteId || typeof prerequisiteId !== "string" || !prerequisiteId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'prerequisiteId' is required and must be a valid task ID string",
        },
        { status: 400 }
      );
    }

    if (!dependentId || typeof dependentId !== "string" || !dependentId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'dependentId' is required and must be a valid task ID string",
        },
        { status: 400 }
      );
    }

    const result = await addDependency(prerequisiteId.trim(), dependentId.trim());

    return NextResponse.json(
      {
        success: true,
        message: "Dependency successfully established",
        data: {
          dependentTask: result.dependentTask,
          readiness: result.readiness,
        },
      },
      { status: 201 }
    );
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

    const message = error instanceof Error ? error.message : "Database error occurred";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create dependency",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dependencies
 * Removes an existing directed dependency edge: prerequisiteId -> dependentId
 * and recalculates affected task states.
 */
export async function DELETE(request: NextRequest) {
  try {
    let prerequisiteId: string | null = null;
    let dependentId: string | null = null;

    // Check request body first, fallback to searchParams
    try {
      const body = await request.json();
      if (body && typeof body === "object") {
        prerequisiteId = body.prerequisiteId || null;
        dependentId = body.dependentId || null;
      }
    } catch {
      // Body is optional if params are provided in URL query string
    }

    if (!prerequisiteId || !dependentId) {
      const url = new URL(request.url);
      prerequisiteId = prerequisiteId || url.searchParams.get("prerequisiteId");
      dependentId = dependentId || url.searchParams.get("dependentId");
    }

    if (!prerequisiteId || typeof prerequisiteId !== "string" || !prerequisiteId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'prerequisiteId' is required to remove dependency",
        },
        { status: 400 }
      );
    }

    if (!dependentId || typeof dependentId !== "string" || !dependentId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'dependentId' is required to remove dependency",
        },
        { status: 400 }
      );
    }

    const result = await removeDependency(prerequisiteId.trim(), dependentId.trim());

    return NextResponse.json(
      {
        success: true,
        message: "Dependency successfully removed",
        data: {
          dependentTask: result.dependentTask,
          readiness: result.readiness,
        },
      },
      { status: 200 }
    );
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

    const message = error instanceof Error ? error.message : "Database error occurred";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to remove dependency",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
