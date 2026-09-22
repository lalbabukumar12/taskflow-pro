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
  calculateTaskDependencyState,
  calculateAllDependencyStates,
  attachDependencyStatesToTasks,
} from "../src/lib/dag/taskState";
import { TaskNode } from "../src/lib/dag/graph";

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

async function runTaskStateTests() {
  console.log("\n================================================================================");
  console.log("🧪 TASKFLOW PRO - BLOCKED / READY DERIVED STATE ENGINE TESTS");
  console.log("================================================================================\n");

  // ==========================================
  // SCENARIO 1: No Prerequisites
  // ==========================================
  console.log("🔹 [Scenario 1] Tasks with NO prerequisites");
  const noPrereqsTasks: TaskNode[] = [
    { id: "T_BACKLOG", title: "Backlog Item", status: "BACKLOG", dependencyIds: [] },
    { id: "T_PROGRESS", title: "Active Feature", status: "IN_PROGRESS", dependencyIds: [] },
    { id: "T_DONE", title: "Shipped Item", status: "DONE", dependencyIds: [] },
  ];

  const stateNoPrereqBacklog = calculateTaskDependencyState("T_BACKLOG", noPrereqsTasks);
  assert(
    stateNoPrereqBacklog.dependencyState === "READY" &&
      !stateNoPrereqBacklog.isBlocked &&
      stateNoPrereqBacklog.isReady &&
      stateNoPrereqBacklog.totalPrerequisites === 0,
    "No prerequisites (BACKLOG) -> dependencyState is READY, isBlocked is false"
  );

  const stateNoPrereqDone = calculateTaskDependencyState("T_DONE", noPrereqsTasks);
  assert(
    stateNoPrereqDone.dependencyState === "DONE" &&
      !stateNoPrereqDone.isBlocked &&
      stateNoPrereqDone.isCompleted,
    "No prerequisites (DONE) -> dependencyState is DONE, isCompleted is true"
  );

  // ==========================================
  // SCENARIO 2: One Unfinished Prerequisite
  // ==========================================
  console.log("\n🔹 [Scenario 2] Task with ONE unfinished prerequisite (A -> B)");
  const singleUnfinishedTasks: TaskNode[] = [
    { id: "A", title: "Task A", status: "IN_PROGRESS", dependencyIds: [] },
    { id: "B", title: "Task B", status: "BACKLOG", dependencyIds: ["A"] },
  ];

  const stateB_blocked = calculateTaskDependencyState("B", singleUnfinishedTasks);
  assert(
    stateB_blocked.dependencyState === "BLOCKED" &&
      stateB_blocked.isBlocked &&
      !stateB_blocked.isReady &&
      stateB_blocked.blockingPrerequisites.length === 1 &&
      stateB_blocked.blockingPrerequisites[0].id === "A",
    "B depends on A (IN_PROGRESS) -> B is BLOCKED, blockingPrerequisites contains A"
  );

  // ==========================================
  // SCENARIO 3: Multiple Prerequisites (Mixed Done / Unfinished)
  // ==========================================
  console.log("\n🔹 [Scenario 3] Task with MULTIPLE prerequisites (A [DONE], B [IN_PROGRESS] -> C)");
  const multipleMixedTasks: TaskNode[] = [
    { id: "A", title: "Database Schema", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Auth Service", status: "IN_PROGRESS", dependencyIds: [] },
    { id: "C", title: "Backend API", status: "BACKLOG", dependencyIds: ["A", "B"] },
  ];

  const stateC_mixed = calculateTaskDependencyState("C", multipleMixedTasks);
  assert(
    stateC_mixed.dependencyState === "BLOCKED" &&
      stateC_mixed.isBlocked &&
      stateC_mixed.totalPrerequisites === 2 &&
      stateC_mixed.completedPrerequisitesCount === 1 &&
      stateC_mixed.readinessPercentage === 50 &&
      stateC_mixed.blockingPrerequisites.length === 1 &&
      stateC_mixed.blockingPrerequisites[0].id === "B",
    "C depends on A (DONE) and B (IN_PROGRESS) -> C is BLOCKED (50% ready), blockingPrerequisites is [B]"
  );

  // ==========================================
  // SCENARIO 4: All Prerequisites Complete
  // ==========================================
  console.log("\n🔹 [Scenario 4] Task with ALL prerequisites complete (A [DONE], B [DONE] -> C)");
  const allCompleteTasks: TaskNode[] = [
    { id: "A", title: "Database Schema", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Auth Service", status: "DONE", dependencyIds: [] },
    { id: "C", title: "Backend API", status: "BACKLOG", dependencyIds: ["A", "B"] },
  ];

  const stateC_ready = calculateTaskDependencyState("C", allCompleteTasks);
  assert(
    stateC_ready.dependencyState === "READY" &&
      !stateC_ready.isBlocked &&
      stateC_ready.isReady &&
      stateC_ready.completedPrerequisitesCount === 2 &&
      stateC_ready.readinessPercentage === 100 &&
      stateC_ready.blockingPrerequisites.length === 0,
    "All prerequisites complete (A & B are DONE) -> C transitions to READY (100% ready)"
  );

  // ==========================================
  // SCENARIO 5: Multiple Levels (A -> B -> C)
  // ==========================================
  console.log("\n🔹 [Scenario 5] Multi-level chain (A -> B -> C)");
  // Level 1: A (DONE) -> B (IN_PROGRESS) -> C (BACKLOG)
  const multiLevelTasks1: TaskNode[] = [
    { id: "A", title: "Architecture Spec", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Core Library", status: "IN_PROGRESS", dependencyIds: ["A"] },
    { id: "C", title: "CLI Tool", status: "BACKLOG", dependencyIds: ["B"] },
  ];

  const stateB_lvl1 = calculateTaskDependencyState("B", multiLevelTasks1);
  const stateC_lvl1 = calculateTaskDependencyState("C", multiLevelTasks1);
  assert(
    stateB_lvl1.dependencyState === "READY" && !stateB_lvl1.isBlocked,
    "Level 2 (B): Prerequisite A is DONE -> B is READY (can be worked on)"
  );
  assert(
    stateC_lvl1.dependencyState === "BLOCKED" && stateC_lvl1.isBlocked,
    "Level 3 (C): Prerequisite B is IN_PROGRESS -> C is BLOCKED"
  );

  // When B finishes and becomes DONE:
  const multiLevelTasks2: TaskNode[] = [
    { id: "A", title: "Architecture Spec", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Core Library", status: "DONE", dependencyIds: ["A"] },
    { id: "C", title: "CLI Tool", status: "BACKLOG", dependencyIds: ["B"] },
  ];
  const stateC_lvl2 = calculateTaskDependencyState("C", multiLevelTasks2);
  assert(
    stateC_lvl2.dependencyState === "READY" && !stateC_lvl2.isBlocked,
    "When Level 2 (B) becomes DONE -> Level 3 (C) transitions to READY"
  );

  // ==========================================
  // SCENARIO 6: Rollback from DONE to IN_PROGRESS
  // ==========================================
  console.log("\n🔹 [Scenario 6] Status ROLLBACK (A: DONE -> IN_PROGRESS -> B becomes BLOCKED again)");
  // Step 1: Initial state where A is DONE, B is READY
  const step1Tasks: TaskNode[] = [
    { id: "A", title: "Task A", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Task B", status: "BACKLOG", dependencyIds: ["A"] },
  ];
  const step1_B = calculateTaskDependencyState("B", step1Tasks);
  assert(
    step1_B.dependencyState === "READY" && !step1_B.isBlocked,
    "Step 1: A is DONE -> B is READY"
  );

  // Step 2: A is rolled back to IN_PROGRESS (e.g., bug found during review)
  const step2Tasks: TaskNode[] = [
    { id: "A", title: "Task A", status: "IN_PROGRESS", dependencyIds: [] },
    { id: "B", title: "Task B", status: "BACKLOG", dependencyIds: ["A"] },
  ];
  const step2_B = calculateTaskDependencyState("B", step2Tasks);
  assert(
    step2_B.dependencyState === "BLOCKED" &&
      step2_B.isBlocked &&
      !step2_B.isReady &&
      step2_B.blockingPrerequisites.length === 1 &&
      step2_B.blockingPrerequisites[0].id === "A",
    "Step 2: A rolled back to IN_PROGRESS -> B immediately becomes BLOCKED again"
  );

  // Step 3: A completes again -> B becomes READY again
  const step3Tasks: TaskNode[] = [
    { id: "A", title: "Task A", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Task B", status: "BACKLOG", dependencyIds: ["A"] },
  ];
  const step3_B = calculateTaskDependencyState("B", step3Tasks);
  assert(
    step3_B.dependencyState === "READY" && !step3_B.isBlocked,
    "Step 3: A completed again -> B returns to READY"
  );

  // ==========================================
  // SCENARIO 7: API Batch Decoration Helper
  // ==========================================
  console.log("\n🔹 [Scenario 7] attachDependencyStatesToTasks helper");
  const decorated = attachDependencyStatesToTasks(step2Tasks);
  assert(
    decorated[0].dependencyState === "READY" &&
      decorated[1].dependencyState === "BLOCKED" &&
      decorated[1].isBlocked === true,
    "attachDependencyStatesToTasks correctly decorates task array with dependencyState properties"
  );

  console.log("\n================================================================================");
  console.log(`🏁 TASK STATE ENGINE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTaskStateTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
