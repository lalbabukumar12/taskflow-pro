import path from "node:path";
import fs from "node:fs";
import mongoose from "mongoose";

// Load environment variables from .env.local or .env if not already populated
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const value = trimmed.slice(eqIdx + 1).trim().replace(/(^['"]|['"]$)/g, "");
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

loadEnv();

async function main() {
  console.log("🌱 Starting TaskFlow Pro Database Seeder...");

  if (!process.env.MONGODB_URI) {
    console.error(
      "❌ Error: MONGODB_URI environment variable is not defined in .env.local or .env."
    );
    console.error(
      "👉 Please configure MONGODB_URI in your .env.local file. Example:\n" +
        "   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/taskflow_pro?retryWrites=true&w=majority\n" +
        "   or for local MongoDB:\n" +
        "   MONGODB_URI=mongodb://127.0.0.1:27017/taskflow_pro"
    );
    process.exit(1);
  }

  // Import after env loaded
  const { seedDatabase } = await import("../src/lib/db/seed");

  try {
    const result = await seedDatabase({ dropExisting: true });
    console.log(`\n✅ Database successfully seeded with ${result.totalSeeded} tasks!\n`);
    console.log("--------------------------------------------------------------------------------");
    console.log("TASK DEPENDENCY GRAPH (Prerequisites):");
    console.log("--------------------------------------------------------------------------------");

    const idToTitle = new Map<string, string>();
    for (const t of result.tasks) {
      idToTitle.set((t._id as mongoose.Types.ObjectId).toString(), t.title);
    }

    for (const t of result.tasks) {
      const idStr = (t._id as mongoose.Types.ObjectId).toString();
      const deps = t.dependencyIds.map((depId: any) => idToTitle.get(depId.toString()) || depId.toString());
      const depsFormatted = deps.length > 0 ? deps.join(", ") : "None (Root task)";
      console.log(`• [${t.status.padEnd(11)}] ${t.title}`);
      console.log(`  └─ Prerequisites: ${depsFormatted}`);
    }

    console.log("--------------------------------------------------------------------------------\n");
    await mongoose.disconnect();
    console.log("🔌 MongoDB connection closed gracefully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed with error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
