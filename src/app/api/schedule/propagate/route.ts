import { NextRequest, NextResponse } from "next/server";
import {
  previewScheduleImpact,
  applySchedulePropagation,
} from "@/lib/scheduling";

/**
 * POST /api/schedule/propagate
 *
 * Body:
 * - taskId: string (required)
 * - deltaDays: number (required)
 * - previewOnly: boolean (optional, default false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, deltaDays, previewOnly = false } = body;

    if (!taskId || typeof deltaDays !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: "Fields 'taskId' (string) and 'deltaDays' (number) are required",
        },
        { status: 400 }
      );
    }

    if (previewOnly) {
      const preview = await previewScheduleImpact(taskId, deltaDays);
      return NextResponse.json({
        success: true,
        preview: true,
        data: preview,
      });
    }

    const result = await applySchedulePropagation(taskId, deltaDays);
    return NextResponse.json({
      success: true,
      message: `Propagated ${deltaDays} days shift to ${result.totalUpdatedCount} task(s)`,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      {
        success: false,
        error: "Failed to propagate schedule change",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
