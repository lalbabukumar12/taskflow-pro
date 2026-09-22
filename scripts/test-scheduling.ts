import path from "node:path";
import fs from "node:fs";

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
  propagateScheduleChange,
  calculateDeltaDays,
  shiftDateByDays,
} from "../src/lib/scheduling/propagation";
import {
  applySchedulePropagation,
  previewScheduleImpact,
} from "../src/lib/scheduling/operations";
import { TaskNode } from "../src/lib/dag/graph";
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

async function runSchedulingTests() {
  console.log("\n================================================================================");
  console.log("⏱️ TASKFLOW PRO - SCHEDULE PROPAGATION & ANTI-COMPOUNDING TEST SUITE");
  console.log("================================================================================\n");

  const baseDate = new Date("2026-06-01T00:00:00.000Z");

  // =========================================================================
  // TEST 1: A -> B (A changes +3, B changes +3)
  // =========================================================================
  console.log("📦 [Test 1] Direct Dependency: A -> B");
  const test1Tasks: TaskNode[] = [
    {
      id: "A",
      title: "Task A",
      status: "BACKLOG",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-05T00:00:00.000Z"),
      dependencyIds: [],
    },
    {
      id: "B",
      title: "Task B",
      status: "BACKLOG",
      startDate: new Date("2026-06-06T00:00:00.000Z"),
      dueDate: new Date("2026-06-10T00:00:00.000Z"),
      dependencyIds: ["A"],
    },
    {
      id: "X_UNRELATED",
      title: "Unrelated Task X",
      status: "BACKLOG",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-05T00:00:00.000Z"),
      dependencyIds: [],
    },
  ];

  const res1 = propagateScheduleChange(test1Tasks, "A", 3);
  const taskA_1 = res1.updatedTasks.find((t) => t.id === "A")!;
  const taskB_1 = res1.updatedTasks.find((t) => t.id === "B")!;
  const taskX_1 = res1.updatedTasks.find((t) => t.id === "X_UNRELATED")!;

  const deltaA_1 = calculateDeltaDays(test1Tasks[0].startDate, taskA_1.startDate);
  const deltaB_1 = calculateDeltaDays(test1Tasks[1].startDate, taskB_1.startDate);
  const deltaX_1 = calculateDeltaDays(test1Tasks[2].startDate, taskX_1.startDate);

  assert(deltaA_1 === 3, "Test 1: Task A start date moved by +3 days");
  assert(deltaB_1 === 3, "Test 1: Downstream Task B start date moved by +3 days");
  assert(deltaX_1 === 0, "Test 1: Unrelated Task X was NOT modified");

  // =========================================================================
  // TEST 2: A -> B -> C (A changes +3, C receives the correct +3 impact)
  // =========================================================================
  console.log("\n📦 [Test 2] Multi-Level Chain: A -> B -> C");
  const test2Tasks: TaskNode[] = [
    {
      id: "A",
      title: "Task A",
      status: "BACKLOG",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-04T00:00:00.000Z"),
      dependencyIds: [],
    },
    {
      id: "B",
      title: "Task B",
      status: "BACKLOG",
      startDate: new Date("2026-06-05T00:00:00.000Z"),
      dueDate: new Date("2026-06-08T00:00:00.000Z"),
      dependencyIds: ["A"],
    },
    {
      id: "C",
      title: "Task C",
      status: "BACKLOG",
      startDate: new Date("2026-06-09T00:00:00.000Z"),
      dueDate: new Date("2026-06-12T00:00:00.000Z"),
      dependencyIds: ["B"],
    },
  ];

  const res2 = propagateScheduleChange(test2Tasks, "A", 3);
  const taskC_2 = res2.updatedTasks.find((t) => t.id === "C")!;
  const deltaC_2 = calculateDeltaDays(test2Tasks[2].startDate, taskC_2.startDate);
  const deltaDueC_2 = calculateDeltaDays(test2Tasks[2].dueDate, taskC_2.dueDate);

  assert(deltaC_2 === 3, "Test 2: Transitive Task C start date moved by +3 days");
  assert(deltaDueC_2 === 3, "Test 2: Transitive Task C due date moved by +3 days");

  // =========================================================================
  // TEST 3: Diamond Graph: A -> B -> D and A -> C -> D (A changes +3, D changes +3 NOT +6)
  // =========================================================================
  console.log("\n📦 [Test 3] Diamond Graph Anti-Compounding: A -> B -> D and A -> C -> D");
  const test3Tasks: TaskNode[] = [
    {
      id: "A",
      title: "Root A",
      status: "BACKLOG",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-05T00:00:00.000Z"),
      dependencyIds: [],
    },
    {
      id: "B",
      title: "Branch B",
      status: "BACKLOG",
      startDate: new Date("2026-06-06T00:00:00.000Z"),
      dueDate: new Date("2026-06-10T00:00:00.000Z"),
      dependencyIds: ["A"],
    },
    {
      id: "C",
      title: "Branch C",
      status: "BACKLOG",
      startDate: new Date("2026-06-06T00:00:00.000Z"),
      dueDate: new Date("2026-06-10T00:00:00.000Z"),
      dependencyIds: ["A"],
    },
    {
      id: "D",
      title: "Converging Join D",
      status: "BACKLOG",
      startDate: new Date("2026-06-11T00:00:00.000Z"),
      dueDate: new Date("2026-06-15T00:00:00.000Z"),
      dependencyIds: ["B", "C"],
    },
  ];

  const res3 = propagateScheduleChange(test3Tasks, "A", 3);
  const taskB_3 = res3.updatedTasks.find((t) => t.id === "B")!;
  const taskC_3 = res3.updatedTasks.find((t) => t.id === "C")!;
  const taskD_3 = res3.updatedTasks.find((t) => t.id === "D")!;

  const deltaB_3 = calculateDeltaDays(test3Tasks[1].startDate, taskB_3.startDate);
  const deltaC_3 = calculateDeltaDays(test3Tasks[2].startDate, taskC_3.startDate);
  const deltaD_3 = calculateDeltaDays(test3Tasks[3].startDate, taskD_3.startDate);

  assert(deltaB_3 === 3, "Test 3: Branch B changed by +3 days");
  assert(deltaC_3 === 3, "Test 3: Branch C changed by +3 days");
  assert(deltaD_3 === 3, "Test 3: Converging Task D changed by +3 days (EXACTLY +3, NOT +6)");
  assert(deltaD_3 !== 6, "Test 3: Anti-compounding verified: D did NOT double-count to +6 days");

  // =========================================================================
  // TEST 4: Complex Multi-Path: A -> B, A -> C, B -> D, C -> D, D -> E (A changes +5)
  // =========================================================================
  console.log("\n📦 [Test 4] Complex Multi-Path Extended Graph: A -> (B, C) -> D -> E");
  const test4Tasks: TaskNode[] = [
    {
      id: "A",
      title: "Root A",
      status: "BACKLOG",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-04T00:00:00.000Z"),
      dependencyIds: [],
    },
    {
      id: "B",
      title: "Branch B",
      status: "BACKLOG",
      startDate: new Date("2026-06-05T00:00:00.000Z"),
      dueDate: new Date("2026-06-08T00:00:00.000Z"),
      dependencyIds: ["A"],
    },
    {
      id: "C",
      title: "Branch C",
      status: "BACKLOG",
      startDate: new Date("2026-06-05T00:00:00.000Z"),
      dueDate: new Date("2026-06-08T00:00:00.000Z"),
      dependencyIds: ["A"],
    },
    {
      id: "D",
      title: "Converging D",
      status: "BACKLOG",
      startDate: new Date("2026-06-09T00:00:00.000Z"),
      dueDate: new Date("2026-06-12T00:00:00.000Z"),
      dependencyIds: ["B", "C"],
    },
    {
      id: "E",
      title: "Terminal E",
      status: "BACKLOG",
      startDate: new Date("2026-06-13T00:00:00.000Z"),
      dueDate: new Date("2026-06-16T00:00:00.000Z"),
      dependencyIds: ["D"],
    },
    {
      id: "UNTOUCHED",
      title: "Independent Task",
      status: "BACKLOG",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      dueDate: new Date("2026-06-10T00:00:00.000Z"),
      dependencyIds: [],
    },
  ];

  const res4 = propagateScheduleChange(test4Tasks, "A", 5);
  const taskB_4 = res4.updatedTasks.find((t) => t.id === "B")!;
  const taskC_4 = res4.updatedTasks.find((t) => t.id === "C")!;
  const taskD_4 = res4.updatedTasks.find((t) => t.id === "D")!;
  const taskE_4 = res4.updatedTasks.find((t) => t.id === "E")!;
  const taskUntouched_4 = res4.updatedTasks.find((t) => t.id === "UNTOUCHED")!;

  const deltaB_4 = calculateDeltaDays(test4Tasks[1].startDate, taskB_4.startDate);
  const deltaC_4 = calculateDeltaDays(test4Tasks[2].startDate, taskC_4.startDate);
  const deltaD_4 = calculateDeltaDays(test4Tasks[3].startDate, taskD_4.startDate);
  const deltaE_4 = calculateDeltaDays(test4Tasks[4].startDate, taskE_4.startDate);
  const deltaUntouched = calculateDeltaDays(test4Tasks[5].startDate, taskUntouched_4.startDate);

  assert(deltaB_4 === 5, "Test 4: Node B shifted by +5 days");
  assert(deltaC_4 === 5, "Test 4: Node C shifted by +5 days");
  assert(deltaD_4 === 5, "Test 4: Converging Node D shifted by +5 days (NOT +10)");
  assert(deltaE_4 === 5, "Test 4: Downstream Node E shifted by +5 days (NOT +10 or +15)");
  assert(deltaUntouched === 0, "Test 4: Independent task remained untouched (0 shift)");

  // =========================================================================
  // TEST 5: Database-Persisted Propagation
  // =========================================================================
  console.log("\n📦 [Test 5] Database-Persisted Schedule Propagation in MongoDB");
  await seedDatabase({ dropExisting: true });

  const seededTasks = await Task.find({}).lean();
  const reqAnalysis = seededTasks.find(
    (t) => t.title === "Requirements Analysis & Architecture Spec"
  )!;
  const prodDeploy = seededTasks.find(
    (t) => t.title === "Production Deployment & Monitoring"
  )!;

  const originalProdStart = new Date(prodDeploy.startDate!).getTime();

  // Shift Requirements Analysis by +4 days in MongoDB
  const dbShiftResult = await applySchedulePropagation(reqAnalysis._id, 4);
  assert(dbShiftResult.totalUpdatedCount > 1, "Database bulk write updated affected downstream tasks");

  const refreshedProd = await Task.findById(prodDeploy._id).lean();
  const newProdStart = new Date(refreshedProd!.startDate!).getTime();
  const dbShiftDays = Math.round((newProdStart - originalProdStart) / (24 * 60 * 60 * 1000));

  assert(
    dbShiftDays === 4,
    `DB Persistence: Production Deployment shifted by exactly +4 days (received ${dbShiftDays})`
  );

  // Clean up
  await seedDatabase({ dropExisting: true });
  await mongoose.disconnect();

  console.log("\n================================================================================");
  console.log(`🏁 SCHEDULING ENGINE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSchedulingTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
