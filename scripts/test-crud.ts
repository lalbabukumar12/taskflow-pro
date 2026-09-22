async function testCrud() {
  const baseUrl = "http://localhost:3000/api/tasks";

  console.log("\n🧪 Running Task CRUD API Automated Verification Suite...\n");

  // 1. GET /api/tasks
  console.log("1️⃣ Testing GET /api/tasks...");
  const resAll = await fetch(baseUrl);
  const jsonAll = await resAll.json();
  console.log(`   Status: ${resAll.status}, Total tasks: ${jsonAll.count}`);
  if (!jsonAll.success || jsonAll.count < 1) throw new Error("GET /api/tasks failed");

  const sampleTask = jsonAll.data[0];
  if (!("dependencyState" in sampleTask) || !("isBlocked" in sampleTask) || !("isReady" in sampleTask)) {
    throw new Error("GET /api/tasks missing calculated dependencyState fields");
  }
  console.log(`   Sample Task: "${sampleTask.title}" -> dependencyState=${sampleTask.dependencyState}, isBlocked=${sampleTask.isBlocked}, isReady=${sampleTask.isReady}`);


  // 2. Validation test - invalid title
  console.log("2️⃣ Testing POST /api/tasks validation (empty title)...");
  const resInvalidTitle = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "" }),
  });
  const jsonInvalidTitle = await resInvalidTitle.json();
  console.log(`   Status: ${resInvalidTitle.status} (Expected 400), Error: ${jsonInvalidTitle.error}`);
  if (resInvalidTitle.status !== 400) throw new Error("Validation test failed for empty title");

  // 3. Validation test - startDate > dueDate
  console.log("3️⃣ Testing POST /api/tasks validation (startDate > dueDate)...");
  const resInvalidDates = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Bad Dates Task",
      startDate: "2026-05-10",
      dueDate: "2026-05-01",
    }),
  });
  const jsonInvalidDates = await resInvalidDates.json();
  console.log(`   Status: ${resInvalidDates.status} (Expected 400), Error: ${jsonInvalidDates.error}`);
  if (resInvalidDates.status !== 400) throw new Error("Validation test failed for bad dates");

  // 4. POST /api/tasks - Create Parent Task A and Child Task B
  console.log("4️⃣ Testing POST /api/tasks - creating Prerequisite Task A...");
  const resTaskA = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Prerequisite Service A",
      description: "Must be completed before B",
      status: "BACKLOG",
      duration: 3,
      position: 10,
    }),
  });
  const jsonTaskA = await resTaskA.json();
  const taskAId = jsonTaskA.data.id;
  console.log(`   Created Task A: ID=${taskAId}, Title=${jsonTaskA.data.title}`);

  console.log("5️⃣ Testing POST /api/tasks - creating Dependent Task B with dependency on Task A...");
  const resTaskB = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Dependent Consumer B",
      description: "Depends on Service A",
      status: "BACKLOG",
      dependencyIds: [taskAId],
    }),
  });
  const jsonTaskB = await resTaskB.json();
  const taskBId = jsonTaskB.data.id;
  console.log(`   Created Task B: ID=${taskBId}, Dependencies=${JSON.stringify(jsonTaskB.data.dependencyIds)}`);

  // 6. GET /api/tasks/[id]
  console.log("6️⃣ Testing GET /api/tasks/[id]...");
  const resGetTaskB = await fetch(`${baseUrl}/${taskBId}`);
  const jsonGetTaskB = await resGetTaskB.json();
  console.log(`   Status: ${resGetTaskB.status}, Title: ${jsonGetTaskB.data.title}, Dependencies populated: ${jsonGetTaskB.data.dependencies ? jsonGetTaskB.data.dependencies.length : 0}`);
  if (resGetTaskB.status !== 200 || jsonGetTaskB.data.id !== taskBId) {
    throw new Error("GET /api/tasks/[id] failed");
  }

  // 7. PATCH /api/tasks/[id]
  console.log("7️⃣ Testing PATCH /api/tasks/[id] (updating status & position)...");
  const resPatch = await fetch(`${baseUrl}/${taskBId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "IN_PROGRESS",
      position: 5,
      description: "Updated description during active sprint",
    }),
  });
  const jsonPatch = await resPatch.json();
  console.log(`   Status: ${resPatch.status}, Updated status: ${jsonPatch.data.status}, New position: ${jsonPatch.data.position}`);
  if (jsonPatch.data.status !== "IN_PROGRESS" || jsonPatch.data.position !== 5) {
    throw new Error("PATCH /api/tasks/[id] failed");
  }

  // 8. DELETE /api/tasks/[id] - Delete Task A and verify Task B has its dependencyId removed!
  console.log("8️⃣ Testing DELETE /api/tasks/[id] - deleting Task A (should unbind from Task B)...");
  const resDeleteA = await fetch(`${baseUrl}/${taskAId}`, {
    method: "DELETE",
  });
  const jsonDeleteA = await resDeleteA.json();
  console.log(`   Delete Task A Status: ${resDeleteA.status}, Unlinked count: ${jsonDeleteA.unlinkedDependenciesCount}`);

  // 9. Verify Task B dependencyIds no longer contains Task A
  console.log("9️⃣ Verifying Task B after Task A deletion...");
  const resCheckB = await fetch(`${baseUrl}/${taskBId}`);
  const jsonCheckB = await resCheckB.json();
  console.log(`   Task B dependencyIds: ${JSON.stringify(jsonCheckB.data.dependencyIds)} (Expected empty [])`);
  if (jsonCheckB.data.dependencyIds.includes(taskAId)) {
    throw new Error("DELETE dependency unlinking failed: Task B still has deleted Task A in dependencyIds!");
  }

  // 10. Clean up Task B
  await fetch(`${baseUrl}/${taskBId}`, { method: "DELETE" });

  // 11. Invalid ID / 404 tests
  console.log("🔟 Testing Error handling (Invalid Mongo ID & 404 not found)...");
  const resInvalidId = await fetch(`${baseUrl}/invalid-id-123`);
  console.log(`   Invalid ID status: ${resInvalidId.status} (Expected 400)`);
  if (resInvalidId.status !== 400) throw new Error("Invalid ID test failed");

  const nonExistentMongoId = "507f1f77bcf86cd799439011";
  const resNotFound = await fetch(`${baseUrl}/${nonExistentMongoId}`);
  console.log(`   Not found status: ${resNotFound.status} (Expected 404)`);
  if (resNotFound.status !== 404) throw new Error("404 test failed");

  console.log("\n🎉 All Task CRUD API tests PASSED successfully!\n");
}

testCrud().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
