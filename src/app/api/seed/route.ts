import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/db/seed";

export async function POST() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        {
          success: false,
          message: "MONGODB_URI environment variable is not defined",
        },
        { status: 500 }
      );
    }

    const result = await seedDatabase({ dropExisting: true });

    return NextResponse.json({
      success: true,
      message: `Database successfully seeded with ${result.totalSeeded} tasks`,
      totalTasks: result.totalSeeded,
      tasks: result.tasks,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        message: "Failed to seed database",
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Send a POST request to /api/seed to populate the database with seed tasks.",
  });
}
