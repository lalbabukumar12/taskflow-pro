"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Plus,
  RefreshCw,
  Search,
  AlertCircle,
  Sparkles,
  Filter,
  CheckCircle2,
  Lock,
  Kanban,
} from "lucide-react";
import { Task, TaskStatus, KanbanColumnDefinition } from "@/types/task";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { TaskModal } from "./TaskModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { DeleteTaskModal } from "./DeleteTaskModal";
import { AiSuggestionsModal } from "./AiSuggestionsModal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const KANBAN_COLUMNS: KanbanColumnDefinition[] = [
  {
    id: "BACKLOG",
    title: "Backlog",
    accentColor: "bg-slate-400",
    borderAccent: "border-slate-800/80",
    bgTint: "bg-slate-900/30",
  },
  {
    id: "IN_PROGRESS",
    title: "In Progress",
    accentColor: "bg-amber-400",
    borderAccent: "border-amber-900/30",
    bgTint: "bg-amber-950/10",
  },
  {
    id: "REVIEW",
    title: "Review",
    accentColor: "bg-indigo-400",
    borderAccent: "border-indigo-900/30",
    bgTint: "bg-indigo-950/10",
  },
  {
    id: "DONE",
    title: "Done",
    accentColor: "bg-emerald-400",
    borderAccent: "border-emerald-900/30",
    bgTint: "bg-emerald-950/10",
  },
];

interface KanbanBoardProps {
  onTasksUpdate?: (tasks: Task[]) => void;
}

export function KanbanBoard({ onTasksUpdate }: KanbanBoardProps) {
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<"ALL" | "READY" | "BLOCKED">("ALL");

  // Drag and Drop active item
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalInitialStatus, setModalInitialStatus] = useState<TaskStatus>("BACKLOG");

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Sensor configuration for @dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // 4px distance constraint to differentiate clicks from drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch tasks from database
  const fetchTasks = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      else setIsRefreshing(true);
      setFetchError(null);

      try {
        const res = await fetch("/api/tasks");
        if (!res.ok) {
          throw new Error(`Failed to load tasks (Status ${res.status})`);
        }
        const json = await res.json();
        const taskData: Task[] = json.data || [];
        setTasks(taskData);
        onTasksUpdate?.(taskData);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error connecting to server";
        setFetchError(msg);
        showToast("error", "Database Error", msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [onTasksUpdate, showToast]
  );

  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  // Filtered tasks computation
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        searchQuery === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesReadiness =
        readinessFilter === "ALL" ||
        (readinessFilter === "READY" && t.isReady) ||
        (readinessFilter === "BLOCKED" && t.isBlocked);

      return matchesSearch && matchesReadiness;
    });
  }, [tasks, searchQuery, readinessFilter]);

  // Drag Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const foundTask = tasks.find((t) => t.id === active.id);
    if (foundTask) {
      setActiveTask(foundTask);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    const isOverTask = over.data.current?.type === "Task";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveTask) return;

    // Moving over another task
    if (isActiveTask && isOverTask) {
      setTasks((currentTasks) => {
        const activeIndex = currentTasks.findIndex((t) => t.id === activeId);
        const overIndex = currentTasks.findIndex((t) => t.id === overId);

        if (activeIndex === -1 || overIndex === -1) return currentTasks;

        const activeTaskItem = currentTasks[activeIndex];
        const overTaskItem = currentTasks[overIndex];

        if (activeTaskItem.status !== overTaskItem.status) {
          const updated = [...currentTasks];
          updated[activeIndex] = {
            ...activeTaskItem,
            status: overTaskItem.status,
          };
          return arrayMove(updated, activeIndex, overIndex);
        }

        return arrayMove(currentTasks, activeIndex, overIndex);
      });
    }

    // Moving over an empty column
    if (isActiveTask && isOverColumn) {
      setTasks((currentTasks) => {
        const activeIndex = currentTasks.findIndex((t) => t.id === activeId);
        if (activeIndex === -1) return currentTasks;

        const updated = [...currentTasks];
        updated[activeIndex] = {
          ...updated[activeIndex],
          status: overId as TaskStatus,
        };
        return updated;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id.toString();
    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    // Find destination status and position
    let targetStatus: TaskStatus = draggedTask.status;
    let targetPosition = draggedTask.position ?? 0;

    if (over.data.current?.type === "Column") {
      targetStatus = over.data.current.status as TaskStatus;
    } else if (over.data.current?.type === "Task") {
      const overTask = over.data.current.task as Task;
      targetStatus = overTask.status;
    }

    const columnTasks = tasks.filter((t) => t.status === targetStatus);
    const newIndex = columnTasks.findIndex((t) => t.id === activeId);
    targetPosition = newIndex >= 0 ? newIndex : 0;

    // Snapshot for rollback in case of network or API failure
    const previousTasksSnapshot = [...tasks];

    // Optimistic state update is already in local state, now persist to API
    try {
      const res = await fetch(`/api/tasks/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          position: targetPosition,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }

      const json = await res.json();
      showToast(
        "success",
        "Task Moved",
        `"${draggedTask.title}" moved to ${targetStatus}`
      );

      // Refresh full dataset to update dynamic dependency readiness across graph
      fetchTasks(false);
    } catch (err: unknown) {
      // Rollback optimistic update
      setTasks(previousTasksSnapshot);
      const msg = err instanceof Error ? err.message : "Failed to update task position";
      showToast("error", "Move Failed (Rolled Back)", msg);
    }
  };

  // Task Creation & Editing Handlers
  const handleOpenCreateModal = (status: TaskStatus = "BACKLOG") => {
    setEditingTask(null);
    setModalInitialStatus(status);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (editingTask) {
      // Update existing task
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to update task");
      }

      showToast("success", "Task Updated", `"${taskData.title}" has been saved.`);
    } else {
      // Create new task
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create task");
      }

      showToast("success", "Task Created", `"${taskData.title}" added to pipeline.`);
    }

    await fetchTasks(false);
  };

  // Delete Handlers
  const handleOpenDeleteModal = (task: Task) => {
    setTaskToDelete(task);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;

    const res = await fetch(`/api/tasks/${taskToDelete.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errJson = await res.json();
      throw new Error(errJson.error || "Failed to delete task");
    }

    showToast("info", "Task Deleted", `"${taskToDelete.title}" and its dependencies were removed.`);
    await fetchTasks(false);
  };

  // Detail Modal Handlers
  const handleOpenDetailModal = (task: Task) => {
    const fresh = tasks.find((t) => t.id === task.id) || task;
    setSelectedTask(fresh);
    setIsDetailModalOpen(true);
  };

  const handleAddDependency = async (prerequisiteId: string, dependentId: string) => {
    const res = await fetch("/api/dependencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prerequisiteId, dependentId }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Failed to add dependency (Status ${res.status})`);
    }

    showToast("success", "Dependency Established", "Prerequisite successfully linked.");
    await fetchTasks(false);

    // Refresh selected task in detail modal
    if (selectedTask && selectedTask.id === dependentId) {
      const updatedTask = json.data?.dependentTask;
      if (updatedTask) {
        setSelectedTask(updatedTask);
      } else {
        setSelectedTask((prev) =>
          prev
            ? {
                ...prev,
                dependencyIds: [...(prev.dependencyIds || []), prerequisiteId],
              }
            : null
        );
      }
    }
  };

  const handleRemoveDependency = async (prerequisiteId: string, dependentId: string) => {
    const res = await fetch("/api/dependencies", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prerequisiteId, dependentId }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Failed to unlink dependency");
    }

    showToast("info", "Dependency Unlinked", "Prerequisite removed successfully.");
    await fetchTasks(false);

    // Refresh selected task in detail modal
    if (selectedTask && selectedTask.id === dependentId) {
      const updatedTask = json.data?.dependentTask;
      if (updatedTask) {
        setSelectedTask(updatedTask);
      } else {
        setSelectedTask((prev) =>
          prev
            ? {
                ...prev,
                dependencyIds: (prev.dependencyIds || []).filter((id) => id !== prerequisiteId),
              }
            : null
        );
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Control Bar: Search, Readiness Filters, Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 backdrop-blur-md">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, descriptions..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Middle: Readiness Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setReadinessFilter("ALL")}
            className={cn(
              "px-3 py-1 rounded-lg font-medium transition-colors shrink-0",
              readinessFilter === "ALL"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setReadinessFilter("READY")}
            className={cn(
              "flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition-colors shrink-0",
              readinessFilter === "READY"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-emerald-400"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready ({tasks.filter((t) => t.isReady).length})
          </button>
          <button
            onClick={() => setReadinessFilter("BLOCKED")}
            className={cn(
              "flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition-colors shrink-0",
              readinessFilter === "BLOCKED"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-slate-400 hover:text-rose-400"
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            Blocked ({tasks.filter((t) => t.isBlocked).length})
          </button>
        </div>

        {/* Right: Actions (AI Suggest, Refresh & New Task) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 px-3 py-2 text-xs font-semibold text-indigo-300 hover:border-indigo-500/60 hover:text-white transition-all shadow-sm"
            title="Suggest missing prerequisite dependencies using OpenAI"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            <span className="hidden sm:inline">Suggest Dependencies with AI</span>
            <span className="sm:hidden">AI Suggestions</span>
          </button>

          <button
            onClick={() => fetchTasks(false)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh database state"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-indigo-400")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal("BACKLOG")}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Fetch Error Banner */}
      {fetchError && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-rose-400" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => fetchTasks(true)}
            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Kanban Drag-and-Drop Columns Area */}
      <div className="flex-1 min-h-[460px] w-full overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-[1240px] h-full">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                accentColor={col.accentColor}
                borderAccent={col.borderAccent}
                bgTint={col.bgTint}
                tasks={filteredTasks.filter((task) => task.status === col.id)}
                isLoading={isLoading}
                onAddTask={handleOpenCreateModal}
                onViewDetails={handleOpenDetailModal}
                onEdit={handleOpenEditModal}
                onDelete={handleOpenDeleteModal}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
        allTasks={tasks}
        initialStatus={modalInitialStatus}
      />

      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        task={selectedTask}
        allTasks={tasks}
        onEdit={handleOpenEditModal}
        onDelete={handleOpenDeleteModal}
        onAddDependency={handleAddDependency}
        onRemoveDependency={handleRemoveDependency}
      />

      <DeleteTaskModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        task={taskToDelete}
      />

      <AiSuggestionsModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onDependencyApproved={() => fetchTasks(false)}
      />
    </div>
  );
}
