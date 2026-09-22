import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";

export async function GET() {
  try {
    let dbStatus = "not_configured";
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
      dbStatus = "connected";
    }

    return NextResponse.json({
      status: "ok",
      appName: "TaskFlow Pro API",
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to connect to database",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
