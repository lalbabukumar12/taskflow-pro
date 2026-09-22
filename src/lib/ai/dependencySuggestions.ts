import Task from "@/models/Task";
import { connectToDatabase } from "@/lib/db/connect";
import { TaskNode, buildDependencyGraph, wouldCreateCycle, normalizeId } from "@/lib/dag/graph";
import { isValidObjectId } from "@/lib/validations/task";

export interface RawAiSuggestion {
  prerequisiteId: string;
  dependentId: string;
  reason: string;
}

export interface ValidatedAiSuggestion {
  id: string;
  prerequisiteId: string;
  prerequisiteTitle: string;
  prerequisiteStatus: string;
  dependentId: string;
  dependentTitle: string;
  dependentStatus: string;
  reason: string;
}

export interface AiSuggestionResponse {
  success: boolean;
  configured: boolean;
  totalSuggested: number;
  totalValid: number;
  rejectedCount: number;
  suggestions: ValidatedAiSuggestion[];
  rejectionReasons?: string[];
  message?: string;
}

/**
 * Calls OpenAI API (Server-Side Only) to analyze software development tasks
 * and generate logical prerequisite dependency suggestions.
 *
 * Strict Multi-Stage Safety Pipeline:
 * 1. Checks OPENAI_API_KEY configuration.
 * 2. Validates every returned ID against active MongoDB documents.
 * 3. Rejects invalid task IDs and non-existent documents.
 * 4. Rejects self-dependencies (A -> A).
 * 5. Rejects existing/duplicate dependencies.
 * 6. Runs DAG cycle detection on every suggestion.
 * 7. Enforces cumulative cycle safety across simultaneous suggestions.
 * 8. NEVER modifies the database automatically.
 */
export async function generateDependencySuggestions(): Promise<AiSuggestionResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_openai_api_key_here") {
    return {
      success: false,
      configured: false,
      totalSuggested: 0,
      totalValid: 0,
      rejectedCount: 0,
      suggestions: [],
      message:
        "OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env.local file to enable AI-augmented dependency suggestions.",
    };
  }

  await connectToDatabase();
  const allTasks = await Task.find({}).lean();

  if (allTasks.length < 2) {
    return {
      success: true,
      configured: true,
      totalSuggested: 0,
      totalValid: 0,
      rejectedCount: 0,
      suggestions: [],
      message: "At least 2 tasks are required in the project to suggest dependencies.",
    };
  }

  // Format task graph for LLM context
  const taskMap = new Map<string, any>();
  const idToTitle = new Map<string, string>();
  for (const t of allTasks) {
    const id = t._id.toString();
    taskMap.set(id, t);
    idToTitle.set(id, t.title);
  }

  const tasksPromptPayload = allTasks.map((t) => {
    const id = t._id.toString();
    const existingPrereqs = (t.dependencyIds || []).map(
      (depId: any) => idToTitle.get(depId.toString()) || depId.toString()
    );

    return {
      taskId: id,
      title: t.title,
      description: t.description || "",
      status: t.status,
      currentPrerequisites: existingPrereqs,
    };
  });

  const systemPrompt = `You are a Principal Software Architect and Agile Project Workflow Specialist.
Analyze the provided collection of software development tasks and suggest logical prerequisite dependencies.

Important Rules:
1. Prerequisite Semantics: If Task B requires Task A to be completed first, then Task A is the prerequisite of Task B (Task A -> Task B).
   - "prerequisiteId" MUST be Task A's taskId.
   - "dependentId" MUST be Task B's taskId.
2. Only suggest logical, high-confidence prerequisite connections based on real-world engineering sequences (e.g., Schema -> API, UI Design -> Frontend, Tests -> Deployment).
3. Do NOT suggest dependencies that already exist in "currentPrerequisites".
4. Do NOT suggest self-dependencies (a task cannot depend on itself).
5. Never create circular dependencies.
6. Provide a concise, professional 1-sentence explanation for each suggestion in "reason".

Return ONLY valid JSON matching this exact schema:
{
  "suggestions": [
    {
      "prerequisiteId": "<exact taskId of prerequisite>",
      "dependentId": "<exact taskId of dependent>",
      "reason": "<clear explanation of why dependent needs prerequisite first>"
    }
  ]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Here are the current project tasks:\n${JSON.stringify(
              tasksPromptPayload,
              null,
              2
            )}\n\nSuggest up to 4 high-value missing prerequisite dependencies.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `OpenAI API returned status ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // use status text
      }

      return {
        success: false,
        configured: true,
        totalSuggested: 0,
        totalValid: 0,
        rejectedCount: 0,
        suggestions: [],
        message: `OpenAI API error: ${errorMsg}`,
      };
    }

    const completion = await response.json();
    const contentStr = completion.choices?.[0]?.message?.content || "{}";
    const parsedData = JSON.parse(contentStr);
    const rawSuggestions: RawAiSuggestion[] = Array.isArray(parsedData.suggestions)
      ? parsedData.suggestions
      : [];

    // Multi-stage validation and safety filter
    const validatedSuggestions: ValidatedAiSuggestion[] = [];
    const rejectionReasons: string[] = [];

    // Simulated task state to check cumulative cycle safety across multiple simultaneous suggestions
    let simulatedTasks: TaskNode[] = (allTasks as unknown as TaskNode[]).map((t) => ({
      id: normalizeId(t._id || t.id),
      title: t.title,
      status: t.status,
      dependencyIds: (t.dependencyIds || []).map((id: any) => normalizeId(id)),
    }));

    for (const raw of rawSuggestions) {
      const prereqId = normalizeId(raw.prerequisiteId);
      const depId = normalizeId(raw.dependentId);

      // 1. Validate ID syntax
      if (!isValidObjectId(prereqId) || !isValidObjectId(depId)) {
        rejectionReasons.push(`Invalid ObjectId format: '${prereqId}' or '${depId}'`);
        continue;
      }

      // 2. Reject self-dependency
      if (prereqId === depId) {
        rejectionReasons.push(`Rejected self-dependency on task ID ${prereqId}`);
        continue;
      }

      // 3. Verify task existence in MongoDB
      const prereqTask = taskMap.get(prereqId);
      const depTask = taskMap.get(depId);

      if (!prereqTask || !depTask) {
        rejectionReasons.push(
          `Task not found in database: prereq (${prereqId}) or dep (${depId})`
        );
        continue;
      }

      // 4. Reject existing dependencies
      const existingPrereqIds = (depTask.dependencyIds || []).map((id: any) =>
        normalizeId(id)
      );
      if (existingPrereqIds.includes(prereqId)) {
        rejectionReasons.push(
          `Duplicate: '${depTask.title}' already depends on '${prereqTask.title}'`
        );
        continue;
      }

      // 5. Check DAG cycle detection against current and cumulative simulated graph
      const createsCycle = wouldCreateCycle(simulatedTasks, prereqId, depId);
      if (createsCycle) {
        rejectionReasons.push(
          `Cycle rejected: Adding '${prereqTask.title}' -> '${depTask.title}' would create a circular dependency`
        );
        continue;
      }

      // 6. Update simulated graph so future suggestions in this batch don't create multi-suggestion cycles
      simulatedTasks = simulatedTasks.map((t) => {
        if (t.id === depId) {
          return {
            ...t,
            dependencyIds: [...(t.dependencyIds || []), prereqId],
          };
        }
        return t;
      });

      validatedSuggestions.push({
        id: `ai-sugg-${prereqId}-${depId}`,
        prerequisiteId: prereqId,
        prerequisiteTitle: prereqTask.title,
        prerequisiteStatus: prereqTask.status,
        dependentId: depId,
        dependentTitle: depTask.title,
        dependentStatus: depTask.status,
        reason: raw.reason || "Logical prerequisite sequence based on architecture.",
      });
    }

    return {
      success: true,
      configured: true,
      totalSuggested: rawSuggestions.length,
      totalValid: validatedSuggestions.length,
      rejectedCount: rejectionReasons.length,
      suggestions: validatedSuggestions,
      rejectionReasons: rejectionReasons.length > 0 ? rejectionReasons : undefined,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error during AI generation";
    return {
      success: false,
      configured: true,
      totalSuggested: 0,
      totalValid: 0,
      rejectedCount: 0,
      suggestions: [],
      message: `Failed to process AI suggestions: ${msg}`,
    };
  }
}
