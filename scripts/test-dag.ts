import path from "node:path";
import fs from "node:fs";

// Load environment variables from .env.local or .env
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

import {
  buildDependencyGraph,
  wouldCreateCycle,
  topologicalSort,
  TaskNode,
} from "../src/lib/dag/graph";
import {
  calculateTaskReadiness,
  calculateAllTaskStates,
} from "../src/lib/dag/readiness";
import {
  addDependency,
  removeDependency,
  getDownstreamTasks,
  getPrerequisiteTasks,
  DagValidationError,
} from "../src/lib/dag/operations";
import mongoose from "mongoose";
import Task from "../src/models/Task";
import { seedDatabase } from "../src/lib/db/seed";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (errorMsg) console.error(`     Reason: ${errorMsg}`);
    failedCount++;
  }
}

async function runAllDagTests() {
  console.log("\n================================================================================");
  console.log("🚀 TASKFLOW PRO - CORE DAG DEPENDENCY ENGINE TEST SUITE");
  console.log("================================================================================\n");

  // ==========================================
  // SUITE 1: Pure Graph Algorithm Unit Tests
  // ==========================================
  console.log("📦 [1] PURE GRAPH ALGORITHM & CYCLE DETECTION TESTS\n");

  // Mock Tasks:
  // A -> B -> C -> D
  // E -> C
  const mockTasks: TaskNode[] = [
    { id: "A", title: "Task A", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Task B", status: "DONE", dependencyIds: ["A"] },
    { id: "C", title: "Task C", status: "IN_PROGRESS", dependencyIds: ["B"] },
    { id: "D", title: "Task D", status: "BACKLOG", dependencyIds: ["C"] },
    { id: "E", title: "Task E", status: "DONE", dependencyIds: [] },
  ];

  // Test 1: Valid Dependency (New independent connection: E -> B)
  const cycleEB = wouldCreateCycle(mockTasks, "E", "B");
  assert(!cycleEB, "Valid dependency: E -> B should NOT create cycle");

  // Test 2: Self Dependency (A -> A)
  const cycleSelf = wouldCreateCycle(mockTasks, "A", "A");
  assert(cycleSelf, "Self dependency: A -> A MUST create cycle / be rejected");

  // Test 3: Simple 2-Node Cycle (A -> B exists, trying B -> A)
  const cycleBA = wouldCreateCycle(mockTasks, "B", "A");
  assert(cycleBA, "Simple cycle: B -> A must be detected (since A -> B exists)");

  // Test 4: Multi-Level Cycle (A -> B -> C exists, trying C -> A)
  const cycleCA = wouldCreateCycle(mockTasks, "C", "A");
  assert(cycleCA, "Multi-level cycle: C -> A must be detected (since A -> B -> C exists)");

  // Test 5: Deep Multi-Level Cycle (A -> B -> C -> D exists, trying D -> A)
  const cycleDA = wouldCreateCycle(mockTasks, "D", "A");
  assert(cycleDA, "Deep multi-level cycle: D -> A must be detected (since A -> B -> C -> D exists)");

  // Test 6: Valid Branching (A -> B, adding A -> E)
  const cycleAE = wouldCreateCycle(mockTasks, "A", "E");
  assert(!cycleAE, "Valid branching: A -> E should be allowed");

  // Test 7: Valid Converging Paths (E -> C when B -> C already exists)
  const cycleEC = wouldCreateCycle(mockTasks, "E", "C");
  assert(!cycleEC, "Valid converging paths: E -> C should be allowed (diamond DAG)");

  // Test 8: Diamond Cycle (A -> B -> D, A -> C -> D; trying D -> A)
  const diamondTasks: TaskNode[] = [
    { id: "A", title: "Root A", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Branch B", status: "DONE", dependencyIds: ["A"] },
    { id: "C", title: "Branch C", status: "DONE", dependencyIds: ["A"] },
    { id: "D", title: "Join D", status: "BACKLOG", dependencyIds: ["B", "C"] },
  ];
  const diamondCycle = wouldCreateCycle(diamondTasks, "D", "A");
  assert(diamondCycle, "Diamond graph cycle: D -> A must be detected as cycle");

  // Test 9: Topological Sort on Diamond
  const sorted = topologicalSort(diamondTasks);
  const isAFirst = sorted[0] === "A";
  const isDLast = sorted[sorted.length - 1] === "D";
  assert(isAFirst && isDLast, "Topological sort: Resolves valid execution order (A first, D last)");

  // ==========================================
  // SUITE 2: Dynamic Readiness State Tests
  // ==========================================
  console.log("\n📦 [2] DYNAMIC READINESS & BLOCKING STATE CALCULATIONS\n");

  // A (DONE) -> B (IN_PROGRESS) -> C (BACKLOG)
  const readinessTasks: TaskNode[] = [
    { id: "T1", title: "Specification", status: "DONE", dependencyIds: [] },
    { id: "T2", title: "Implementation", status: "IN_PROGRESS", dependencyIds: ["T1"] },
    { id: "T3", title: "Testing", status: "BACKLOG", dependencyIds: ["T2"] },
  ];

  // T1 (No prerequisites, DONE)
  const stateT1 = calculateTaskReadiness("T1", readinessTasks);
  assert(
    stateT1.computedReadiness === "DONE" && !stateT1.isBlocked && stateT1.readinessPercentage === 100,
    "Root completed task T1: computedReadiness === 'DONE', 100% ready"
  );

  // T2 (Prereq T1 is DONE, status is IN_PROGRESS)
  const stateT2 = calculateTaskReadiness("T2", readinessTasks);
  assert(
    stateT2.computedReadiness === "IN_PROGRESS" && !stateT2.isBlocked && stateT2.readinessPercentage === 100,
    "Task T2 with all prerequisites completed: isBlocked === false"
  );

  // T3 (Prereq T2 is IN_PROGRESS -> T3 is BLOCKED)
  const stateT3 = calculateTaskReadiness("T3", readinessTasks);
  assert(
    stateT3.computedReadiness === "BLOCKED" && stateT3.isBlocked && stateT3.blockingPrerequisites.length === 1,
    "Task T3 with pending prerequisite: computedReadiness === 'BLOCKED', isBlocked === true"
  );

  // calculateAllTaskStates
  const allStates = calculateAllTaskStates(readinessTasks);
  assert(
    Object.keys(allStates).length === 3 && allStates["T3"].isBlocked,
    "calculateAllTaskStates: Generates complete computed state dictionary"
  );

  // ==========================================
  // SUITE 3: Database-Backed DAG Operations
  // ==========================================
  console.log("\n📦 [3] DATABASE-PERSISTED DAG OPERATIONS & ENFORCEMENT\n");

  // Seed clean 10-task dataset
  const seedResult = await seedDatabase({ dropExisting: true });
  const tasks = await Task.find({}).lean();
  const titleToTask = new Map<string, any>();
  for (const t of tasks) {
    titleToTask.set(t.title, t);
  }

  const reqTask = titleToTask.get("Requirements Analysis & Architecture Spec");
  const dbTask = titleToTask.get("Database Schema & Data Modeling");
  const apiTask = titleToTask.get("Backend API & Business Logic");
  const prodTask = titleToTask.get("Production Deployment & Monitoring");

  assert(Boolean(reqTask && dbTask && apiTask && prodTask), "Database seeded and tasks retrieved");

  // Test 10: Reject Self-Dependency in DB
  let selfDepRejected = false;
  try {
    await addDependency(reqTask._id, reqTask._id);
  } catch (err: any) {
    selfDepRejected = err instanceof DagValidationError && err.code === "SELF_DEPENDENCY_REJECTED";
  }
  assert(selfDepRejected, "DB addDependency: Rejects self-dependency with SELF_DEPENDENCY_REJECTED error");

  // Test 11: Reject Duplicate Dependency in DB (dbTask already depends on reqTask)
  let dupRejected = false;
  try {
    await addDependency(reqTask._id, dbTask._id);
  } catch (err: any) {
    dupRejected = err instanceof DagValidationError && err.code === "DUPLICATE_DEPENDENCY_REJECTED";
  }
  assert(dupRejected, "DB addDependency: Rejects duplicate dependency with DUPLICATE_DEPENDENCY_REJECTED error");

  // Test 12: Reject Direct Cycle in DB (reqTask -> dbTask -> apiTask; trying apiTask -> reqTask)
  let cycleRejected = false;
  try {
    await addDependency(apiTask._id, reqTask._id);
  } catch (err: any) {
    cycleRejected = err instanceof DagValidationError && err.code === "CYCLE_DETECTED";
  }
  assert(cycleRejected, "DB addDependency: Rejects cycle (API -> Req) with CYCLE_DETECTED error");

  // Test 13: Verify Invalid Dependency was NOT Persisted
  const reqTaskAfter = await Task.findById(reqTask._id).lean();
  const hasInvalidDep = reqTaskAfter?.dependencyIds.some(
    (id: any) => id.toString() === apiTask._id.toString()
  );
  assert(!hasInvalidDep, "Data integrity: Rejected cyclical dependency was NOT persisted in MongoDB");

  // Test 14: Valid Branching / Additional Prerequisite in DB
  const uiTask = titleToTask.get("UI/UX Design & Design System");
  // Adding UI Design -> Performance Testing (valid new edge)
  const perfTask = titleToTask.get("Performance Testing & Benchmarking");
  const addEdgeRes = await addDependency(uiTask._id, perfTask._id);
  assert(
    addEdgeRes.dependentTask.dependencyIds.includes(uiTask._id.toString()),
    "DB addDependency: Successfully persisted valid new dependency edge (UI -> Performance)"
  );

  // Test 15: removeDependency in DB
  const removeEdgeRes = await removeDependency(uiTask._id, perfTask._id);
  assert(
    !removeEdgeRes.dependentTask.dependencyIds.includes(uiTask._id.toString()),
    "DB removeDependency: Successfully removed dependency edge"
  );

  // Test 16: getDownstreamTasks (Transitive downstream of Requirements Analysis)
  const downstreamOfReq = await getDownstreamTasks(reqTask._id);
  const titles = downstreamOfReq.map((t) => t.title);
  const hasDb = titles.includes("Database Schema & Data Modeling");
  const hasApi = titles.includes("Backend API & Business Logic");
  const hasProd = titles.includes("Production Deployment & Monitoring");
  assert(
    hasDb && hasApi && hasProd,
    "getDownstreamTasks: Correctly resolves transitive downstream closure (Database, API, Production)"
  );

  // Test 17: getPrerequisiteTasks (Transitive prerequisites of Production Deployment)
  const prereqsOfProd = await getPrerequisiteTasks(prodTask._id);
  const prereqTitles = prereqsOfProd.map((t) => t.title);
  assert(
    prereqTitles.includes("Requirements Analysis & Architecture Spec") &&
      prereqTitles.includes("Integration & End-to-End Tests"),
    "getPrerequisiteTasks: Correctly resolves transitive prerequisite ancestors"
  );

  // Clean up
  await seedDatabase({ dropExisting: true });
  await mongoose.disconnect();

  console.log("\n================================================================================");
  console.log(`🏁 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllDagTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
