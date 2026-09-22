import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Settings from "@/models/Settings";

/**
 * GET /api/settings
 * Returns workspace configuration settings along with safe system metadata.
 * NO secrets or connection strings are exposed.
 */
export async function GET() {
  try {
    await connectToDatabase();

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const aiConfigured = Boolean(
      process.env.OPENAI_API_KEY &&
        process.env.OPENAI_API_KEY.trim() !== "" &&
        process.env.OPENAI_API_KEY !== "your_openai_api_key_here"
    );

    return NextResponse.json({
      success: true,
      data: {
        workspaceName: settings.workspaceName,
        workspaceDescription: settings.workspaceDescription,
        theme: settings.theme,
        layoutPreference: settings.layoutPreference,
        defaultTaskStatus: settings.defaultTaskStatus,
        defaultTaskDuration: settings.defaultTaskDuration,
        system: {
          aiConfigured,
          databaseStatus: "connected",
          appName: "TaskFlow Pro",
          version: "1.0.0",
          techStack: "Next.js 16 (App Router) • TypeScript 5 • MongoDB (Mongoose) • Tailwind CSS v4 • @dnd-kit",
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error loading settings";
    return NextResponse.json(
      {
        success: false,
        error: "SETTINGS_FETCH_FAILED",
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * Updates workspace configuration settings in MongoDB.
 */
export async function PATCH(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const allowedUpdates: Record<string, any> = {};
    if (typeof body.workspaceName === "string") {
      allowedUpdates.workspaceName = body.workspaceName.trim();
    }
    if (typeof body.workspaceDescription === "string") {
      allowedUpdates.workspaceDescription = body.workspaceDescription.trim();
    }
    if (["dark", "light", "system"].includes(body.theme)) {
      allowedUpdates.theme = body.theme;
    }
    if (["compact", "comfortable"].includes(body.layoutPreference)) {
      allowedUpdates.layoutPreference = body.layoutPreference;
    }
    if (["BACKLOG", "IN_PROGRESS", "REVIEW", "DONE"].includes(body.defaultTaskStatus)) {
      allowedUpdates.defaultTaskStatus = body.defaultTaskStatus;
    }
    if (typeof body.defaultTaskDuration === "number" && body.defaultTaskDuration >= 1) {
      allowedUpdates.defaultTaskDuration = body.defaultTaskDuration;
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(allowedUpdates);
    } else {
      Object.assign(settings, allowedUpdates);
      await settings.save();
    }

    return NextResponse.json({
      success: true,
      data: settings,
      message: "Settings saved successfully",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error saving settings";
    return NextResponse.json(
      {
        success: false,
        error: "SETTINGS_SAVE_FAILED",
        message,
      },
      { status: 500 }
    );
  }
}
