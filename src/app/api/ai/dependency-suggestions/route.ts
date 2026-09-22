import { NextResponse } from "next/server";
import { generateDependencySuggestions } from "@/lib/ai/dependencySuggestions";

/**
 * POST /api/ai/dependency-suggestions
 *
 * Uses OpenAI API (Server-Side Only) to generate intelligent prerequisite suggestions.
 * Strictly validates all suggestions against active MongoDB task documents and runs
 * DAG cycle detection before returning suggestions to the client.
 *
 * NOTE: This endpoint NEVER modifies the database.
 * The user must explicitly approve each suggestion in the UI.
 */
export async function POST() {
  try {
    const result = await generateDependencySuggestions();

    if (!result.configured) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          error: "OPENAI_API_KEY_NOT_CONFIGURED",
          message: result.message,
          suggestions: [],
        },
        { status: 200 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          error: "AI_GENERATION_FAILED",
          message: result.message,
          suggestions: [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      configured: true,
      data: {
        suggestions: result.suggestions,
        totalSuggested: result.totalSuggested,
        totalValid: result.totalValid,
        rejectedCount: result.rejectedCount,
        rejectionReasons: result.rejectionReasons,
        message: result.message,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: "INTERNAL_SERVER_ERROR",
        message: `Unexpected error: ${message}`,
        suggestions: [],
      },
      { status: 500 }
    );
  }
}
