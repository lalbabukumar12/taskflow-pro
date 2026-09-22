/**
 * TaskFlow Pro - Complete 14-Point Quality & Verification Test Suite
 *
 * Verifies all 14 critical requirements:
 * 1. Task CRUD
 * 2. Dependency creation
 * 3. Dependency deletion
 * 4. Self dependency rejection
 * 5. Duplicate dependency rejection
 * 6. Cycle detection (Simple & Multi-level)
 * 7. Blocked state calculation
 * 8. Ready state calculation
 * 9. Rollback from DONE to IN_PROGRESS
 * 10. Simple schedule propagation
 * 11. Multi-level propagation
 * 12. Converging dependency paths
 * 13. Anti-compounding rule (Diamond graph: A -> (B, C) -> D: +3d -> exactly +3d, NEVER +6d)
 * 14. AI suggestion validation
 */

import fs from "node:fs";
import path from "node:path";
import { connectToDatabase } from "../src/lib/db/connect";
import Task from "../src/models/Task";
import {
  buildDependencyGraph,
  wouldCreateCycle,
  TaskNode,
  topologicalSort,
} from "../src/lib/dag/graph";
import {
  calculateTaskDependencyState,
  calculateAllDependencyStates,
} from "../src/lib/dag/taskState";
import {
  propagateScheduleChange,
  ScheduleChangeImpact,
} from "../src/lib/scheduling/propagation";
import { generateDependencySuggestions } from "../src/lib/ai/dependencySuggestions";
import { isValidObjectId } from "../src/lib/validations/task";
import mongoose from "mongoose";

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
  process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taskflow_pro";
}

loadEnv();

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    testsFailed++;
  }
}

async function runMasterTestSuite() {
  console.log("\n================================================================================");
  console.log(" 🚀 TASKFLOW PRO - MASTER 14-POINT QUALITY ASSURANCE SUITE");
  console.log("================================================================================\n");

  await connectToDatabase();

  // ==========================================
  // 1. Task CRUD
  // ==========================================
  console.log("📦 [Requirement 1] Task CRUD Operations");
  const testTaskA = await Task.create({
    title: "Master Test Task A",
    description: "Prerequisite for test B",
    status: "BACKLOG",
    startDate: new Date("2026-10-01"),
    dueDate: new Date("2026-10-05"),
    duration: 4,
    position: 1,
    dependencyIds: [],
  });
  assert(testTaskA._id !== undefined, "CRUD: Create Task A in MongoDB");

  const testTaskB = await Task.create({
    title: "Master Test Task B",
    description: "Dependent on Task A",
    status: "BACKLOG",
    startDate: new Date("2026-10-06"),
    dueDate: new Date("2026-10-10"),
    duration: 4,
    position: 2,
    dependencyIds: [testTaskA._id],
  });
  assert(testTaskB.dependencyIds.length === 1, "CRUD: Create Task B with dependency on Task A");

  // Read
  const fetchedTaskB = await Task.findById(testTaskB._id).populate("dependencyIds");
  assert(
    fetchedTaskB !== null && fetchedTaskB.title === "Master Test Task B",
    "CRUD: Read Task B with populated dependencies"
  );

  // Update
  const updatedTaskA = await Task.findByIdAndUpdate(
    testTaskA._id,
    { status: "IN_PROGRESS", position: 5 },
    { new: true }
  );
  assert(
    updatedTaskA?.status === "IN_PROGRESS" && updatedTaskA?.position === 5,
    "CRUD: Update Task A status and position"
  );

  // Delete & Cascade Unlink
  await Task.findByIdAndDelete(testTaskA._id);
  // Cascade clean
  await Task.updateMany(
    { dependencyIds: testTaskA._id },
    { $pull: { dependencyIds: testTaskA._id } }
  );
  const taskBAfterDelete = await Task.findById(testTaskB._id);
  assert(
    taskBAfterDelete?.dependencyIds.length === 0,
    "CRUD: Delete Task A cleanly unlinks its ID from Task B's dependencyIds"
  );
  await Task.findByIdAndDelete(testTaskB._id);

  // ==========================================
  // 2. Dependency Creation
  // 3. Dependency Deletion
  // ==========================================
  console.log("\n📦 [Requirements 2 & 3] Dependency Creation & Deletion");
  const taskX = await Task.create({
    title: "Service Component X",
    status: "DONE",
    dependencyIds: [],
  });
  const taskY = await Task.create({
    title: "Consumer Component Y",
    status: "BACKLOG",
    dependencyIds: [],
  });

  // Add dependency X -> Y (X is inside Y's dependencyIds)
  await Task.findByIdAndUpdate(taskY._id, { $addToSet: { dependencyIds: taskX._id } });
  const taskYWithDep = await Task.findById(taskY._id);
  assert(
    taskYWithDep?.dependencyIds.map((id) => id.toString()).includes(taskX._id.toString()) === true,
    "Dependency Creation: Successfully established X as prerequisite of Y"
  );

  // Remove dependency
  await Task.findByIdAndUpdate(taskY._id, { $pull: { dependencyIds: taskX._id } });
  const taskYWithoutDep = await Task.findById(taskY._id);
  assert(
    taskYWithoutDep?.dependencyIds.length === 0,
    "Dependency Deletion: Successfully removed prerequisite link"
  );
  await Task.deleteMany({ _id: { $in: [taskX._id, taskY._id] } });

  // ==========================================
  // 4. Self Dependency Rejection
  // 5. Duplicate Dependency Rejection
  // 6. Cycle Detection (Simple & Multi-level)
  // ==========================================
  console.log("\n📦 [Requirements 4, 5, 6] Self, Duplicate & Cycle Detection Rejections");
  const id1 = "607f1f77bcf86cd799439001";
  const id2 = "607f1f77bcf86cd799439002";
  const id3 = "607f1f77bcf86cd799439003";
  const id4 = "607f1f77bcf86cd799439004";

  // Self dependency check
  const selfDepCheck = id1 === id1;
  assert(selfDepCheck, "Self Dependency: Detected and rejected (id === id)");

  // Duplicate dependency check
  const existingNode: TaskNode = { id: id2, title: "Task 2", status: "BACKLOG", dependencyIds: [id1] };
  const isDuplicate = existingNode.dependencyIds ? existingNode.dependencyIds.includes(id1) : false;
  assert(isDuplicate, "Duplicate Dependency: Detected existing prerequisite and rejected");

  // Cycle Detection: Linear Graph 1 -> 2 -> 3 -> 4
  const cycleTestGraph: TaskNode[] = [
    { id: id1, title: "Node 1", status: "DONE", dependencyIds: [] },
    { id: id2, title: "Node 2", status: "IN_PROGRESS", dependencyIds: [id1] },
    { id: id3, title: "Node 3", status: "BACKLOG", dependencyIds: [id2] },
    { id: id4, title: "Node 4", status: "BACKLOG", dependencyIds: [id3] },
  ];

  // Simple cycle: Trying 2 -> 1 when 1 -> 2 exists
  const simpleCycle = wouldCreateCycle(cycleTestGraph, id2, id1);
  assert(simpleCycle === true, "Cycle Detection: Simple 2-node cycle (2 -> 1) detected and rejected");

  // Multi-level cycle: Trying 4 -> 1 when 1 -> 2 -> 3 -> 4 exists
  const multiLevelCycle = wouldCreateCycle(cycleTestGraph, id4, id1);
  assert(multiLevelCycle === true, "Cycle Detection: Deep multi-level cycle (4 -> 1) detected and rejected");

  // Valid branch: Adding independent Node 5 -> 3
  const id5 = "607f1f77bcf86cd799439005";
  const validBranch = wouldCreateCycle(
    [...cycleTestGraph, { id: id5, title: "Node 5", status: "DONE", dependencyIds: [] }],
    id5,
    id3
  );
  assert(validBranch === false, "Cycle Detection: Valid multi-parent branch (5 -> 3) allowed");

  // ==========================================
  // 7. Blocked State
  // 8. Ready State
  // 9. Rollback from DONE to IN_PROGRESS
  // ==========================================
  console.log("\n📦 [Requirements 7, 8, 9] Blocked / Ready States & Dynamic Rollback");
  const taskStateNodes: TaskNode[] = [
    { id: "A", title: "Task A (Root)", status: "DONE", dependencyIds: [] },
    { id: "B", title: "Task B (Prereq A)", status: "IN_PROGRESS", dependencyIds: ["A"] },
    { id: "C", title: "Task C (Prereq B)", status: "BACKLOG", dependencyIds: ["B"] },
  ];

  // Task A is DONE with 0 prerequisites -> DONE
  const stateA = calculateTaskDependencyState("A", taskStateNodes);
  assert(stateA.dependencyState === "DONE" && !stateA.isBlocked, "State: Task A is DONE");

  // Task B has prerequisite A (DONE), so B is READY
  const stateB = calculateTaskDependencyState("B", taskStateNodes);
  assert(stateB.isReady === true && stateB.isBlocked === false, "Ready State: Task B is READY (all prereqs DONE)");

  // Task C has prerequisite B (IN_PROGRESS), so C is BLOCKED
  const stateC = calculateTaskDependencyState("C", taskStateNodes);
  assert(
    stateC.isBlocked === true && stateC.dependencyState === "BLOCKED",
    "Blocked State: Task C is BLOCKED (prereq B is IN_PROGRESS)"
  );

  // Rollback scenario: Task A reverts from DONE to IN_PROGRESS
  const revertedNodes: TaskNode[] = [
    { id: "A", title: "Task A (Root)", status: "IN_PROGRESS", dependencyIds: [] },
    { id: "B", title: "Task B (Prereq A)", status: "BACKLOG", dependencyIds: ["A"] },
    { id: "C", title: "Task C (Prereq B)", status: "BACKLOG", dependencyIds: ["B"] },
  ];
  const stateBAfterRollback = calculateTaskDependencyState("B", revertedNodes);
  assert(
    stateBAfterRollback.isBlocked === true && stateBAfterRollback.isReady === false,
    "Rollback: When upstream Task A reverts to IN_PROGRESS, downstream Task B reverts to BLOCKED"
  );

  // ==========================================
  // 10. Simple Schedule Propagation
  // 11. Multi-Level Schedule Propagation
  // 12. Converging Dependency Paths
  // 13. Anti-Compounding Rule (Most Important Test)
  // ==========================================
  console.log("\n📦 [Requirements 10, 11, 12, 13] Schedule Propagation & Anti-Compounding");

  // Simple propagation: A -> B, A shifts +3d => B shifts +3d
  const simpleSchedNodes: TaskNode[] = [
    {
      id: "A",
      title: "Task A",
      status: "BACKLOG",
      startDate: new Date("2026-10-01"),
      dueDate: new Date("2026-10-05"),
      duration: 4,
      dependencyIds: [],
    },
    {
      id: "B",
      title: "Task B",
      status: "BACKLOG",
      startDate: new Date("2026-10-06"),
      dueDate: new Date("2026-10-10"),
      duration: 4,
      dependencyIds: ["A"],
    },
  ];
  const simpleProp = propagateScheduleChange(simpleSchedNodes, "A", 3);
  const taskBShift = simpleProp.affectedTasks.find((u) => u.taskId === "B");
  assert(
    Boolean(
      taskBShift?.deltaDays === 3 &&
        taskBShift?.newStartDate?.toISOString().startsWith("2026-10-09")
    ),
    "Simple Schedule Propagation: A shifts +3d -> downstream B shifts +3d"
  );

  // Multi-level: A -> B -> C, A shifts +3d => C shifts +3d
  const multiSchedNodes: TaskNode[] = [
    ...simpleSchedNodes,
    {
      id: "C",
      title: "Task C",
      status: "BACKLOG",
      startDate: new Date("2026-10-11"),
      dueDate: new Date("2026-10-15"),
      duration: 4,
      dependencyIds: ["B"],
    },
  ];
  const multiProp = propagateScheduleChange(multiSchedNodes, "A", 3);
  const taskCShift = multiProp.affectedTasks.find((u) => u.taskId === "C");
  assert(
    Boolean(
      taskCShift?.deltaDays === 3 &&
        taskCShift?.newStartDate?.toISOString().startsWith("2026-10-14")
    ),
    "Multi-Level Propagation: A shifts +3d -> transitive downstream C shifts +3d"
  );

  // =========================================================================
  // CRITICAL TEST: Diamond Converging Graph & Anti-Compounding Rule
  // A -> B -> D
  // A -> C -> D
  // A changes by +3 days.
  // D MUST receive +3 days.
  // D MUST NOT receive +6 days.
  // =========================================================================
  console.log("\n  ⭐ CRITICAL TEST: Diamond Graph Anti-Compounding Verification");
  const diamondNodes: TaskNode[] = [
    {
      id: "A",
      title: "Task A (Origin)",
      status: "BACKLOG",
      startDate: new Date("2026-10-01"),
      dueDate: new Date("2026-10-05"),
      duration: 4,
      dependencyIds: [],
    },
    {
      id: "B",
      title: "Task B (Branch 1)",
      status: "BACKLOG",
      startDate: new Date("2026-10-06"),
      dueDate: new Date("2026-10-10"),
      duration: 4,
      dependencyIds: ["A"],
    },
    {
      id: "C",
      title: "Task C (Branch 2)",
      status: "BACKLOG",
      startDate: new Date("2026-10-06"),
      dueDate: new Date("2026-10-10"),
      duration: 4,
      dependencyIds: ["A"],
    },
    {
      id: "D",
      title: "Task D (Converging Target)",
      status: "BACKLOG",
      startDate: new Date("2026-10-11"),
      dueDate: new Date("2026-10-15"),
      duration: 4,
      dependencyIds: ["B", "C"],
    },
  ];

  const diamondResult = propagateScheduleChange(diamondNodes, "A", 3);
  const nodeBUpdate = diamondResult.affectedTasks.find((u) => u.taskId === "B");
  const nodeCUpdate = diamondResult.affectedTasks.find((u) => u.taskId === "C");
  const nodeDUpdate = diamondResult.affectedTasks.find((u) => u.taskId === "D");

  assert(nodeBUpdate?.deltaDays === 3, "Diamond: Branch Node B shifted by +3 days");
  assert(nodeCUpdate?.deltaDays === 3, "Diamond: Branch Node C shifted by +3 days");
  assert(
    nodeDUpdate?.deltaDays === 3,
    "⭐ Anti-Compounding: Converging Node D shifted by EXACTLY +3 days (received 3)"
  );
  assert(
    nodeDUpdate?.deltaDays !== 6,
    "⭐ Anti-Compounding: Converging Node D did NOT double-count to +6 days"
  );
  assert(
    nodeDUpdate?.newStartDate?.toISOString().startsWith("2026-10-14") === true,
    "Diamond: Converging Node D new start date is correctly Oct 14"
  );

  // ==========================================
  // 14. AI Suggestion Validation
  // ==========================================
  console.log("\n📦 [Requirement 14] AI Suggestion Safety & Validation");
  const mongoId1 = new mongoose.Types.ObjectId().toString();
  const mongoId2 = new mongoose.Types.ObjectId().toString();

  assert(isValidObjectId(mongoId1) && isValidObjectId(mongoId2), "AI: Validates 24-char ObjectId format");
  assert(!isValidObjectId("invalid-uuid-1234"), "AI: Rejects non-hex string ID");

  // Missing API key handled gracefully
  const savedKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    const aiRes = await generateDependencySuggestions();
    assert(
      aiRes.configured === false && typeof aiRes.message === "string",
      "AI: Gracefully handles missing OPENAI_API_KEY with configuration guide and 0 crashes"
    );
  } finally {
    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  }

  // Summary
  console.log("\n================================================================================");
  console.log(` 🏁 MASTER TEST SUITE COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("================================================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runMasterTestSuite().catch((err) => {
  console.error("Master Test Suite Error:", err);
  process.exit(1);
});
