import mongoose from "mongoose";
import Task, { TaskStatus } from "@/models/Task";
import { connectToDatabase } from "@/lib/db/connect";

export interface SeedTaskDefinition {
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  duration: number; // in days
  position: number;
  startDateOffsetDays: number;
  dueDateOffsetDays: number;
  dependencyKeys: string[];
}

export const SEED_TASKS_DATA: SeedTaskDefinition[] = [
  {
    key: "req_analysis",
    title: "Requirements Analysis & Architecture Spec",
    description:
      "Analyze business requirements, specify domain models, establish API contracts, and draft system architecture documentation.",
    status: "DONE",
    duration: 4,
    position: 1,
    startDateOffsetDays: -14,
    dueDateOffsetDays: -10,
    dependencyKeys: [],
  },
  {
    key: "ui_design",
    title: "UI/UX Design & Design System",
    description:
      "Produce high-fidelity Figma components, user workflow mockups, typography tokens, and responsive wireframes.",
    status: "DONE",
    duration: 5,
    position: 2,
    startDateOffsetDays: -12,
    dueDateOffsetDays: -7,
    dependencyKeys: [],
  },
  {
    key: "auth_service",
    title: "Authentication & Authorization Service",
    description:
      "Implement secure OAuth2/JWT token flows, bcrypt password hashing, session middleware, and role-based permissions.",
    status: "DONE",
    duration: 4,
    position: 3,
    startDateOffsetDays: -10,
    dueDateOffsetDays: -6,
    dependencyKeys: [],
  },
  {
    key: "db_schema",
    title: "Database Schema & Data Modeling",
    description:
      "Design MongoDB collections, Mongoose models, compound indexes, and validation rules adhering to domain models.",
    status: "DONE",
    duration: 3,
    position: 4,
    startDateOffsetDays: -9,
    dueDateOffsetDays: -6,
    dependencyKeys: ["req_analysis"],
  },
  {
    key: "backend_api",
    title: "Backend API & Business Logic",
    description:
      "Develop core Next.js API endpoints, CRUD operations, dependency graph calculation algorithms, and error handlers.",
    status: "IN_PROGRESS",
    duration: 6,
    position: 1,
    startDateOffsetDays: -5,
    dueDateOffsetDays: 1,
    dependencyKeys: ["db_schema", "auth_service"],
  },
  {
    key: "frontend_impl",
    title: "Frontend Client Implementation",
    description:
      "Build interactive Next.js application views, Kanban board drag-and-drop state machines, and responsive controls.",
    status: "IN_PROGRESS",
    duration: 7,
    position: 2,
    startDateOffsetDays: -4,
    dueDateOffsetDays: 3,
    dependencyKeys: ["ui_design"],
  },
  {
    key: "security_audit",
    title: "Security & Vulnerability Audit",
    description:
      "Execute automated vulnerability scanning, dependency auditing, CORS/CSP policy enforcement, and OWASP penetration checks.",
    status: "BACKLOG",
    duration: 3,
    position: 1,
    startDateOffsetDays: 2,
    dueDateOffsetDays: 5,
    dependencyKeys: ["backend_api", "auth_service"],
  },
  {
    key: "integration_tests",
    title: "Integration & End-to-End Tests",
    description:
      "Write Playwright and integration tests verifying end-to-end task creation, dependency DAG resolution, and API interactions.",
    status: "BACKLOG",
    duration: 5,
    position: 2,
    startDateOffsetDays: 4,
    dueDateOffsetDays: 9,
    dependencyKeys: ["backend_api", "frontend_impl"],
  },
  {
    key: "perf_testing",
    title: "Performance Testing & Benchmarking",
    description:
      "Conduct k6 load tests, database query profiling, latency benchmarking, and cache optimization.",
    status: "BACKLOG",
    duration: 4,
    position: 3,
    startDateOffsetDays: 6,
    dueDateOffsetDays: 10,
    dependencyKeys: ["backend_api"],
  },
  {
    key: "prod_deploy",
    title: "Production Deployment & Monitoring",
    description:
      "Configure production cluster, CI/CD automated release pipeline, SSL certificates, health checks, and alerting.",
    status: "BACKLOG",
    duration: 2,
    position: 4,
    startDateOffsetDays: 10,
    dueDateOffsetDays: 12,
    dependencyKeys: ["integration_tests", "perf_testing"],
  },
];

/**
 * Seeds the MongoDB database with 10 realistic software-development tasks
 * connected in a Directed Acyclic Graph (DAG) with zero cycles.
 */
export async function seedDatabase(options: { dropExisting?: boolean } = {}) {
  await connectToDatabase();

  const { dropExisting = true } = options;

  if (dropExisting) {
    await Task.deleteMany({});
  }

  const now = new Date();
  const createdTaskMap = new Map<string, mongoose.Types.ObjectId>();

  // Pass 1: Create all task documents with empty dependency arrays to establish ObjectIds
  for (const def of SEED_TASKS_DATA) {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + def.startDateOffsetDays);

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + def.dueDateOffsetDays);

    const taskDoc = await Task.create({
      title: def.title,
      description: def.description,
      status: def.status,
      duration: def.duration,
      position: def.position,
      startDate,
      dueDate,
      dependencyIds: [],
    });

    createdTaskMap.set(def.key, taskDoc._id as mongoose.Types.ObjectId);
  }

  // Pass 2: Connect prerequisite dependencies (dependencyIds)
  for (const def of SEED_TASKS_DATA) {
    if (def.dependencyKeys.length > 0) {
      const targetId = createdTaskMap.get(def.key);
      const prerequisiteObjectIds = def.dependencyKeys.map((depKey) => {
        const depId = createdTaskMap.get(depKey);
        if (!depId) {
          throw new Error(`Prerequisite task key '${depKey}' not found for '${def.key}'`);
        }
        return depId;
      });

      await Task.findByIdAndUpdate(targetId, {
        $set: { dependencyIds: prerequisiteObjectIds },
      });
    }
  }

  const allTasks = await Task.find({}).lean();

  return {
    success: true,
    totalSeeded: allTasks.length,
    tasks: allTasks,
  };
}
