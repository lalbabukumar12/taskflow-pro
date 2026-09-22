# TaskFlow Pro ⚡

> **Next-Generation Project Orchestration Platform with Real-Time DAG Dependency Engine, Non-Compounding Schedule Propagation, and AI-Augmented Dependency Suggestions.**

TaskFlow Pro is a mission-critical project and workflow management system built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, MongoDB (Mongoose), and `@dnd-kit`.

---

## 🌟 Key Features

### 1. Directed Acyclic Graph (DAG) Dependency Engine
- **Strict Cycle Prevention**: Automatically detects and rejects simple, indirect, and multi-level circular dependencies before persistence.
- **Topological Sorting & Traversal**: Identifies prerequisite and downstream task trees across arbitrary depths.
- **Calculated Readiness State**: Tasks dynamically compute `READY` or `BLOCKED` states from the dependency graph without polluting database workflow statuses.
  - A task is `READY` when all prerequisites are `DONE` (or if it has no prerequisites).
  - A task is `BLOCKED` if at least one prerequisite is not `DONE`.
  - State dynamically rolls back if an upstream task reverts from `DONE` to `IN_PROGRESS`.

### 2. Schedule Propagation Engine (Non-Compounding)
- **Topological Cascade**: When an upstream task's dates shift, downstream tasks are rescheduled automatically.
- **Diamond / Converging Dependency Protection**: Eliminates compounding errors across converging paths (e.g., $A \to B \to D$ and $A \to C \to D$). If task $A$ shifts by $+3$ days, task $D$ moves by exactly $+3$ days, never double-counted as $+6$ days.

### 3. Interactive Kanban Board
- **Drag-and-Drop Workflow**: Smooth, accessible drag-and-drop powered by `@dnd-kit` across `BACKLOG`, `IN_PROGRESS`, `REVIEW`, and `DONE` columns.
- **Optimistic UI Updates**: Immediate visual feedback with automatic server synchronization and rollback on failure.
- **Dependency Badges**: Direct visual indicators on cards showing readiness (`READY` / `BLOCKED`), upstream prerequisite count, and downstream dependent count.
- **Filter by Readiness**: Quick filter tabs for `All`, `Ready`, and `Blocked` tasks.

### 4. Comprehensive Task & Dependency Management
- **Task Detail Modal**: Full inspection of task metadata, schedule impact, and live prerequisite/dependent trees.
- **Interactive Prerequisite Linker**: Add and remove prerequisites with real-time cycle prevention and server error feedback.

---

## 🤖 AI-Augmented Dependency Suggestions

TaskFlow Pro integrates OpenAI (`gpt-4o-mini`) on the **server side only** to inspect software development tasks and suggest logical prerequisite relationships with architectural rationale.

### Safety Architecture & Guardrails

The AI suggestion engine operates under **10 strict safety rules**:

1. **Server-Side Only**: The OpenAI API key and requests are strictly isolated to the server (`src/lib/ai/dependencySuggestions.ts`). No API keys or LLM requests touch the client browser.
2. **MongoDB ID Validation**: Every returned task ID is cross-referenced with active MongoDB task documents.
3. **Invalid ID Rejection**: Any malformed or non-existent task IDs are immediately dropped.
4. **Self-Dependency Rejection**: Rejects suggestions where `prerequisiteId === dependentId`.
5. **Duplicate / Existing Dependency Rejection**: Filters out suggestions for prerequisite links that already exist.
6. **DAG Cycle Verification**: Every suggestion is tested against the graph using `wouldCreateCycle()`. Circular dependencies are rejected before reaching the UI.
7. **Batch Cumulative Cycle Safety**: Multi-edge cycles suggested within the same response (e.g. $A \to B$ and $B \to A$) are prevented using a simulated graph state.
8. **ZERO Automatic Database Mutation**: AI suggestions **never** write directly to MongoDB.
9. **Explicit Human Approval**: Suggestions are rendered in an interactive modal with task badges and architectural rationale. The user must explicitly click **Approve** or **Reject**.
10. **Final Validation via Dependency API**: Approved suggestions are dispatched to `POST /api/dependencies`, preserving the core DAG engine as the single source of truth.

### API Endpoint: `POST /api/ai/dependency-suggestions`

#### Request
```http
POST /api/ai/dependency-suggestions
Content-Type: application/json
```

#### Structured JSON Output Format
```json
{
  "success": true,
  "configured": true,
  "data": {
    "suggestions": [
      {
        "id": "ai-sugg-67b123...-67b456...",
        "prerequisiteId": "67b123...",
        "prerequisiteTitle": "Database Schema & Migration",
        "prerequisiteStatus": "DONE",
        "dependentId": "67b456...",
        "dependentTitle": "Backend REST API Endpoints",
        "dependentStatus": "IN_PROGRESS",
        "reason": "Backend API endpoints depend directly on finalized database collections and schemas."
      }
    ],
    "totalSuggested": 1,
    "totalValid": 1,
    "rejectedCount": 0
  }
}
```

### Configuring OpenAI API Key

Create or update `.env.local` in the project root:

```env
# MongoDB Connection
MONGODB_URI=mongodb://127.0.0.1:27017/taskflow_pro

# OpenAI API Key (Server-Side Only)
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
```

> **Note**: If `OPENAI_API_KEY` is missing, TaskFlow Pro degrades gracefully. The UI displays an informative configuration guide in the AI modal with a retry button, rather than crashing or throwing unhandled exceptions.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org)
- **Runtime & Language**: Node.js v22, TypeScript 5
- **Database & ODM**: MongoDB with Mongoose 9
- **Drag-and-Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Styling**: Tailwind CSS v4, Lucide React icons
- **AI Integration**: OpenAI API (`gpt-4o-mini`, server-side JSON schema response)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create `.env.local`:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/taskflow_pro
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Seed Realistic Tasks
Seed 10 realistic software engineering tasks with linear and branching dependencies:
```bash
npm run seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Test Suites

TaskFlow Pro includes automated test suites covering DAG mechanics, schedule cascades, CRUD operations, and AI safety:

```bash
# Run all test suites
npm test

# Run individual test suites
npm run test:dag     # DAG cycle detection, multi-level cycles, branches & convergence
npm run test:state   # Derived READY / BLOCKED state calculations & rollbacks
npm run test:sched   # Non-compounding schedule propagation algorithm
npm run test:crud    # Task CRUD APIs and input validations
npm run test:deps    # Dependency creation/deletion route handlers
npm run test:ai      # AI suggestion safety, missing key handling & batch cycle filtering
```

---

## 📐 Architecture Overview

```
src/
├── app/
│   ├── api/
│   │   ├── ai/dependency-suggestions/ # POST: Server-side AI suggestion endpoint
│   │   ├── dependencies/             # POST, DELETE: Graph dependency manipulation
│   │   └── tasks/                    # GET, POST, PATCH, DELETE: Task CRUD
│   ├── globals.css                   # Tailwind CSS v4 design system
│   ├── layout.tsx                    # App shell and root layout
│   └── page.tsx                      # Dashboard and Kanban view
├── components/
│   ├── kanban/
│   │   ├── AiSuggestionsModal.tsx    # Interactive AI suggestions modal (Approve/Reject)
│   │   ├── DeleteTaskModal.tsx       # Delete confirmation modal
│   │   ├── KanbanBoard.tsx           # Main Kanban board orchestrator (@dnd-kit)
│   │   ├── KanbanColumn.tsx          # Kanban column container
│   │   ├── TaskCard.tsx              # Draggable task card with readiness badges
│   │   ├── TaskDetailModal.tsx       # Detail modal with prerequisite/dependent managers
│   │   └── TaskModal.tsx             # Create/Edit task modal
│   └── ui/
│       └── Toast.tsx                 # Responsive toast notification provider
├── lib/
│   ├── ai/
│   │   └── dependencySuggestions.ts  # OpenAI client, JSON prompt, and 10-rule safety pipeline
│   ├── dag/
│   │   ├── graph.ts                  # DAG engine, cycle detection (DFS/recursion), topological traversal
│   │   ├── operations.ts             # High-level DAG operations
│   │   └── taskState.ts              # Derived READY / BLOCKED calculation engine
│   ├── db/
│   │   └── connect.ts                # MongoDB Mongoose cached connection utility
│   ├── scheduling/
│   │   └── propagation.ts            # Non-compounding graph schedule cascade engine
│   └── validations/
│       └── task.ts                   # Input validation and ObjectId validation helpers
└── models/
    └── Task.ts                       # Mongoose Task schema
```
