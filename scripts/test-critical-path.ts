import { calculateCriticalPath, TaskWithDuration } from "../src/lib/dag/criticalPath";

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    process.exit(1);
  }
}

console.log("\n========================================================");
console.log(" ⚡ TASKFLOW PRO: CRITICAL PATH CALCULATION TESTS");
console.log("========================================================\n");

// Test 1: Linear chain A (3d) -> B (4d) -> C (5d)
// Total critical path = 3 + 4 + 5 = 12 days
const linearTasks: TaskWithDuration[] = [
  { id: "A", title: "Task A", status: "DONE", duration: 3, dependencyIds: [] },
  { id: "B", title: "Task B", status: "IN_PROGRESS", duration: 4, dependencyIds: ["A"] },
  { id: "C", title: "Task C", status: "BACKLOG", duration: 5, dependencyIds: ["B"] },
];

const cp1 = calculateCriticalPath(linearTasks);
assert(cp1.totalDuration === 12, "Linear chain total duration is 12 days");
assert(cp1.criticalTaskIds.join(",") === "A,B,C", "Linear chain critical path is A -> B -> C");
assert(cp1.criticalEdgeKeys.has("A->B") && cp1.criticalEdgeKeys.has("B->C"), "Linear chain critical edges identified");

// Test 2: Diamond graph with two branches:
// Branch 1: A (3d) -> B (2d) -> D (4d) = 3 + 2 + 4 = 9 days
// Branch 2: A (3d) -> C (6d) -> D (4d) = 3 + 6 + 4 = 13 days (Critical Path)
const diamondTasks: TaskWithDuration[] = [
  { id: "A", title: "Architecture", status: "DONE", duration: 3, dependencyIds: [] },
  { id: "B", title: "Quick Prototype", status: "IN_PROGRESS", duration: 2, dependencyIds: ["A"] },
  { id: "C", title: "Robust Backend API", status: "BACKLOG", duration: 6, dependencyIds: ["A"] },
  { id: "D", title: "System Integration", status: "BACKLOG", duration: 4, dependencyIds: ["B", "C"] },
];

const cp2 = calculateCriticalPath(diamondTasks);
assert(cp2.totalDuration === 13, "Diamond graph selects longer branch C (13 days vs 9 days)");
assert(cp2.criticalTaskIds.join(",") === "A,C,D", "Critical path correctly selects A -> C -> D");
assert(!cp2.criticalTaskIds.includes("B"), "Shorter branch B is excluded from critical path");
assert(cp2.criticalEdgeKeys.has("A->C") && cp2.criticalEdgeKeys.has("C->D"), "Critical edges A->C and C->D marked");

// Test 3: Multiple independent roots and chains
// Root 1: X (10d)
// Root 2: Y (2d) -> Z (3d) = 5d
const multiRootTasks: TaskWithDuration[] = [
  { id: "X", title: "Long Independent Project", status: "IN_PROGRESS", duration: 10, dependencyIds: [] },
  { id: "Y", title: "Short Task Y", status: "DONE", duration: 2, dependencyIds: [] },
  { id: "Z", title: "Short Task Z", status: "BACKLOG", duration: 3, dependencyIds: ["Y"] },
];

const cp3 = calculateCriticalPath(multiRootTasks);
assert(cp3.totalDuration === 10, "Selects longest root chain (10 days vs 5 days)");
assert(cp3.criticalTaskIds.join(",") === "X", "Critical path is task X");

console.log("\n========================================================");
console.log(" 📊 SUMMARY: All Critical Path tests PASSED successfully!");
console.log("========================================================\n");
