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

async function testApiDependencies() {
  console.log("\n================================================================================");
  console.log("🔗 TASKFLOW PRO - /api/dependencies ENDPOINT VERIFICATION SUITE");
  console.log("================================================================================\n");

  const baseUrl = "http://localhost:3000/api/dependencies";

  // 0. Seed fresh database
  await seedDatabase({ dropExisting: true });
  const tasks = await Task.find({}).lean();
  const titleToTask = new Map<string, any>();
  for (const t of tasks) {
    titleToTask.set(t.title, t);
  }

  const reqTask = titleToTask.get("Requirements Analysis & Architecture Spec");
  const dbTask = titleToTask.get("Database Schema & Data Modeling");
  const apiTask = titleToTask.get("Backend API & Business Logic");
  const uiTask = titleToTask.get("UI/UX Design & Design System");
  const perfTask = titleToTask.get("Performance Testing & Benchmarking");
  const prodTask = titleToTask.get("Production Deployment & Monitoring");

  // ==========================================
  // Test 1: Validation - Missing parameters (400)
  // ==========================================
  console.log("1️⃣ Testing Missing Parameters Validation...");
  const resMissing = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const jsonMissing = await resMissing.json();
  assert(
    resMissing.status === 400 && jsonMissing.success === false,
    "Missing body parameters returns HTTP 400 Bad Request"
  );

  // ==========================================
  // Test 2: Validation - Missing Task in DB (404)
  // ==========================================
  console.log("\n2️⃣ Testing Non-Existent Task IDs (404)...");
  const nonExistentId = "507f1f77bcf86cd799439011";
  const resNotFound = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prerequisiteId: nonExistentId,
      dependentId: dbTask._id.toString(),
    }),
  });
  const jsonNotFound = await resNotFound.json();
  assert(
    resNotFound.status === 404 && jsonNotFound.code === "PREREQUISITE_NOT_FOUND",
    "Non-existent prerequisite task ID returns HTTP 404 with PREREQUISITE_NOT_FOUND code"
  );

  // ==========================================
  // Test 3: Reject Self Dependency (400)
  // ==========================================
  console.log("\n3️⃣ Testing Self Dependency Rejection (A -> A)...");
  const resSelf = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prerequisiteId: reqTask._id.toString(),
      dependentId: reqTask._id.toString(),
    }),
  });
  const jsonSelf = await resSelf.json();
  assert(
    resSelf.status === 400 && jsonSelf.code === "SELF_DEPENDENCY_REJECTED",
    "Self dependency (A -> A) rejected with HTTP 400 and SELF_DEPENDENCY_REJECTED"
  );

  // ==========================================
  // Test 4: Reject Duplicate Dependency (400)
  // ==========================================
  console.log("\n4️⃣ Testing Duplicate Dependency Rejection...");
  // dbTask already depends on reqTask
  const resDup = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prerequisiteId: reqTask._id.toString(),
      dependentId: dbTask._id.toString(),
    }),
  });
  const jsonDup = await resDup.json();
  assert(
    resDup.status === 400 && jsonDup.code === "DUPLICATE_DEPENDENCY_REJECTED",
    "Duplicate dependency rejected with HTTP 400 and DUPLICATE_DEPENDENCY_REJECTED"
  );

  // ==========================================
  // Test 5: Simple Cycle Rejection (A -> B, trying B -> A)
  // ==========================================
  console.log("\n5️⃣ Testing Simple Cycle Rejection (Req -> DB, trying DB -> Req)...");
  const resCycleSimple = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prerequisiteId: dbTask._id.toString(),
      dependentId: reqTask._id.toString(),
    }),
  });
  const jsonCycleSimple = await resCycleSimple.json();
  assert(
    resCycleSimple.status === 400 && jsonCycleSimple.code === "CYCLE_DETECTED",
    "Simple cycle rejected with HTTP 400 and CYCLE_DETECTED"
  );

  // ==========================================
  // Test 6: Multi-Level Deep Cycle Rejection (Req -> DB -> API -> Prod, trying Prod -> Req)
  // ==========================================
  console.log("\n6️⃣ Testing Multi-Level Deep Cycle Rejection (Prod -> Req)...");
  const resCycleDeep = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prerequisiteId: prodTask._id.toString(),
      dependentId: reqTask._id.toString(),
    }),
  });
  const jsonCycleDeep = await resCycleDeep.json();
  assert(
    resCycleDeep.status === 400 && jsonCycleDeep.code === "CYCLE_DETECTED",
    "Multi-level cycle rejected with HTTP 400 and CYCLE_DETECTED"
  );

  // ==========================================
  // Test 7: Valid Dependency Creation & State Recalculation (UI -> Perf)
  // ==========================================
  console.log("\n7️⃣ Testing Valid Dependency Creation & Readiness Recalculation (UI -> Perf)...");
  const resValid = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prerequisiteId: uiTask._id.toString(),
      dependentId: perfTask._id.toString(),
    }),
  });
  const jsonValid = await resValid.json();
  assert(
    resValid.status === 201 && jsonValid.success === true,
    "Valid dependency created with HTTP 201 Created"
  );
  assert(
    jsonValid.data.dependentTask.dependencyIds.includes(uiTask._id.toString()),
    "Updated dependentTask response contains new prerequisite in dependencyIds"
  );
  assert(
    "dependencyState" in jsonValid.data.dependentTask &&
      "readiness" in jsonValid.data,
    "Response contains recalculated dependencyState and readiness metrics"
  );

  // Verify in MongoDB
  const perfTaskInDb = await Task.findById(perfTask._id).lean();
  const hasUiPrereqInDb = perfTaskInDb?.dependencyIds.some(
    (id: any) => id.toString() === uiTask._id.toString()
  );
  assert(Boolean(hasUiPrereqInDb), "Verified valid dependency is saved in MongoDB");

  // ==========================================
  // Test 8: DELETE Dependency & State Recalculation
  // ==========================================
  console.log("\n8️⃣ Testing DELETE /api/dependencies (removing UI -> Perf)...");
  const resDelete = await fetch(baseUrl, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prerequisiteId: uiTask._id.toString(),
      dependentId: perfTask._id.toString(),
    }),
  });
  const jsonDelete = await resDelete.json();
  assert(
    resDelete.status === 200 && jsonDelete.success === true,
    "Dependency removed with HTTP 200 OK"
  );
  assert(
    !jsonDelete.data.dependentTask.dependencyIds.includes(uiTask._id.toString()),
    "Updated dependentTask response no longer contains removed prerequisite"
  );

  // Verify in MongoDB
  const perfTaskAfterDelete = await Task.findById(perfTask._id).lean();
  const stillHasUiInDb = perfTaskAfterDelete?.dependencyIds.some(
    (id: any) => id.toString() === uiTask._id.toString()
  );
  assert(!stillHasUiInDb, "Verified removed dependency is unlinked in MongoDB");

  // Clean up
  await seedDatabase({ dropExisting: true });
  await mongoose.disconnect();

  console.log("\n================================================================================");
  console.log(`🏁 /api/dependencies ENDPOINT RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testApiDependencies().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
