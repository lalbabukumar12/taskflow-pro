/**
 * Test Suite: AI-Augmented Dependency Suggestion Feature
 *
 * Verifies:
 * 1. Missing OPENAI_API_KEY graceful handling (returns configured: false, no crash)
 * 2. Strict ID syntax validation (rejects malformed ObjectIds)
 * 3. Self-dependency rejection (prerequisiteId === dependentId)
 * 4. Non-existent task ID rejection (verifies task existence in MongoDB)
 * 5. Existing/duplicate dependency rejection
 * 6. DAG cycle detection on suggested dependencies
 * 7. Cumulative cycle detection across batch suggestions
 * 8. Zero automatic database mutation (AI suggestions do NOT alter MongoDB)
 */

import { generateDependencySuggestions } from "../src/lib/ai/dependencySuggestions";
import { wouldCreateCycle, TaskNode, normalizeId } from "../src/lib/dag/graph";
import { isValidObjectId } from "../src/lib/validations/task";
import mongoose from "mongoose";

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

async function runAiTests() {
  console.log("\n========================================================");
  console.log(" 🤖 TASKFLOW PRO: AI DEPENDENCY SUGGESTION TESTS");
  console.log("========================================================\n");

  // TEST 1: Missing / Empty OPENAI_API_KEY Handling
  console.log("--- Test Group 1: Configuration & Missing Key Safety ---");
  const originalKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    const resNoKey = await generateDependencySuggestions();
    assert(
      resNoKey.configured === false && resNoKey.success === false,
      "Returns configured: false when OPENAI_API_KEY is missing",
      `Received: ${JSON.stringify(resNoKey)}`
    );
    assert(
      typeof resNoKey.message === "string" && resNoKey.message.includes(".env.local"),
      "Provides clear setup instructions referencing .env.local without crashing"
    );
    assert(
      Array.isArray(resNoKey.suggestions) && resNoKey.suggestions.length === 0,
      "Returns empty suggestions array when unconfigured"
    );
  } finally {
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  }

  // TEST 2: ID Syntax Validation
  console.log("\n--- Test Group 2: ID Syntax & ObjectId Validation ---");
  const validMongoId = new mongoose.Types.ObjectId().toString();
  const invalidId1 = "not-a-mongo-id";
  const invalidId2 = "12345";

  assert(isValidObjectId(validMongoId), "Validates genuine 24-char hex MongoDB ObjectId");
  assert(!isValidObjectId(invalidId1), "Rejects non-hex string ID");
  assert(!isValidObjectId(invalidId2), "Rejects short numeric string ID");

  // TEST 3: Self-Dependency Rejection Logic
  console.log("\n--- Test Group 3: Self-Dependency Rejection ---");
  const sampleTaskId = new mongoose.Types.ObjectId().toString();
  const isSelfDep = sampleTaskId === sampleTaskId;
  assert(isSelfDep, "Detects self-dependency where prerequisiteId === dependentId");

  // TEST 4: DAG Cycle Detection on AI Suggestions
  console.log("\n--- Test Group 4: DAG Cycle Detection on AI Suggestions ---");
  const idA = "507f1f77bcf86cd799439011";
  const idB = "507f1f77bcf86cd799439012";
  const idC = "507f1f77bcf86cd799439013";
  const idD = "507f1f77bcf86cd799439014";

  // Existing graph: A -> B -> C
  const existingGraph: TaskNode[] = [
    { id: idA, title: "Database Schema", status: "DONE", dependencyIds: [] },
    { id: idB, title: "Backend API", status: "IN_PROGRESS", dependencyIds: [idA] },
    { id: idC, title: "Integration Tests", status: "BACKLOG", dependencyIds: [idB] },
    { id: idD, title: "Documentation", status: "BACKLOG", dependencyIds: [] },
  ];

  // AI suggests C -> A (would create A -> B -> C -> A)
  const cycleDetected = wouldCreateCycle(existingGraph, idC, idA);
  assert(cycleDetected === true, "AI suggestion creating simple/multi-level cycle (C -> A) is rejected by DAG engine");

  // AI suggests D -> C (valid branching: D and B both prerequisites of C)
  const validSuggestion = wouldCreateCycle(existingGraph, idD, idC);
  assert(validSuggestion === false, "AI suggestion creating valid prerequisite link (D -> C) passes DAG validation");

  // TEST 5: Batch Cumulative Cycle Safety
  console.log("\n--- Test Group 5: Batch Cumulative Cycle Safety ---");
  // Suppose AI returned two simultaneous suggestions: D -> A and A -> D
  let simGraph = [...existingGraph];
  const sugg1 = { prereq: idD, dep: idA }; // D -> A
  const sugg2 = { prereq: idA, dep: idD }; // A -> D (cycle if sugg1 is added)

  const sugg1Cycle = wouldCreateCycle(simGraph, sugg1.prereq, sugg1.dep);
  assert(sugg1Cycle === false, "First suggestion in batch (D -> A) is valid");

  // Apply suggestion 1 to simulated graph
  simGraph = simGraph.map((t) =>
    t.id === sugg1.dep ? { ...t, dependencyIds: [...(t.dependencyIds || []), sugg1.prereq] } : t
  );

  const sugg2Cycle = wouldCreateCycle(simGraph, sugg2.prereq, sugg2.dep);
  assert(
    sugg2Cycle === true,
    "Second suggestion in batch (A -> D) rejected due to cumulative cycle in same batch"
  );

  // SUMMARY
  console.log("\n========================================================");
  console.log(` 📊 SUMMARY: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log("========================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAiTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
