"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TaskModal } from "@/components/kanban/TaskModal";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";
import { DeleteTaskModal } from "@/components/kanban/DeleteTaskModal";
import { Task, TaskStatus } from "@/types/task";
import { useToast } from "@/components/ui/Toast";
import {
  CheckSquare,
  Search,
  Plus,
  Filter,
  RefreshCw,
  Clock,
  Calendar,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  GitBranch,
  Layers,
  Inbox,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

type FilterTab = "ALL" | "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED" | "READY";
type SortOption = "position" | "title" | "dueDate" | "duration" | "status";

export default function MyTasksPage() {
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("position");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalInitialStatus, setModalInitialStatus] = useState<TaskStatus>("BACKLOG");

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Fetch tasks from API
  const fetchTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFetchError(null);

    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error(`Failed to fetch tasks (Status ${res.status})`);
      }
      const json = await res.json();
      setTasks(json.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error connecting to server";
      setFetchError(msg);
      showToast("error", "Database Error", msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  // Create or Update task
  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        // Edit existing task
        const res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to update task");
        }
        showToast("success", "Task Updated", `"${taskData.title}" has been updated.`);
      } else {
        // Create new task
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to create task");
        }
        showToast("success", "Task Created", `"${taskData.title}" has been created.`);
      }

      await fetchTasks(false);
      setIsTaskModalOpen(false);
      setEditingTask(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      showToast("error", "Save Failed", msg);
      throw err;
    }
  };

  // Delete task
  const handleConfirmDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete task");
      }
      showToast("success", "Task Deleted", "The task was removed from your workspace.");
      await fetchTasks(false);
      setIsDeleteModalOpen(false);
      setTaskToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete task";
      showToast("error", "Delete Failed", msg);
      throw err;
    }
  };

  // Add / Remove dependency in detail modal
  const handleAddDependency = async (prerequisiteId: string) => {
    if (!selectedTask) return;
    try {
      const res = await fetch("/api/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prerequisiteId,
          dependentId: selectedTask.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to add dependency");
      }
      showToast("success", "Dependency Established", "Prerequisite linked successfully.");
      await fetchTasks(false);
      if (json.data?.dependentTask) {
        setSelectedTask(json.data.dependentTask);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add dependency";
      showToast("error", "Dependency Rejected", msg);
      throw err;
    }
  };

  const handleRemoveDependency = async (prerequisiteId: string) => {
    if (!selectedTask) return;
    try {
      const res = await fetch("/api/dependencies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prerequisiteId,
          dependentId: selectedTask.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to remove dependency");
      }
      showToast("info", "Dependency Removed", "Prerequisite unlinked successfully.");
      await fetchTasks(false);
      if (json.data?.dependentTask) {
        setSelectedTask(json.data.dependentTask);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove dependency";
      showToast("error", "Error", msg);
      throw err;
    }
  };

  // Filter & Search tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q) || false;
          if (!matchTitle && !matchDesc) return false;
        }

        // Tab filter
        if (activeFilter === "ALL") return true;
        if (activeFilter === "BACKLOG") return t.status === "BACKLOG";
        if (activeFilter === "IN_PROGRESS") return t.status === "IN_PROGRESS";
        if (activeFilter === "REVIEW") return t.status === "REVIEW";
        if (activeFilter === "DONE") return t.status === "DONE";
        if (activeFilter === "BLOCKED") return t.isBlocked;
        if (activeFilter === "READY") return t.isReady && t.status !== "DONE";
        return true;
      })
      .sort((a, b) => {
        let compare = 0;
        if (sortBy === "position") {
          compare = (a.position ?? 0) - (b.position ?? 0);
        } else if (sortBy === "title") {
          compare = a.title.localeCompare(b.title);
        } else if (sortBy === "status") {
          compare = a.status.localeCompare(b.status);
        } else if (sortBy === "duration") {
          compare = (a.duration || 1) - (b.duration || 1);
        } else if (sortBy === "dueDate") {
          const d1 = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const d2 = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          compare = d1 - d2;
        }
        return sortOrder === "asc" ? compare : -compare;
      });
  }, [tasks, searchQuery, activeFilter, sortBy, sortOrder]);

  const stats = useMemo(() => {
    return {
      all: tasks.length,
      backlog: tasks.filter((t) => t.status === "BACKLOG").length,
      inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      review: tasks.filter((t) => t.status === "REVIEW").length,
      done: tasks.filter((t) => t.status === "DONE").length,
      blocked: tasks.filter((t) => t.isBlocked).length,
      ready: tasks.filter((t) => t.isReady && t.status !== "DONE").length,
    };
  }, [tasks]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onNewTask={() => {
            setEditingTask(null);
            setModalInitialStatus("BACKLOG");
            setIsTaskModalOpen(true);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {/* Header Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <CheckSquare className="h-6 w-6 text-indigo-400" />
                  My Tasks
                </h1>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                  {tasks.length} Total
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Detailed overview of all tasks, readiness status, prerequisite chains, and schedule timings.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchTasks(false)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh from MongoDB"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-indigo-400")} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => {
                  setEditingTask(null);
                  setModalInitialStatus("BACKLOG");
                  setIsTaskModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Filters & Search Control Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800 backdrop-blur-md">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs">
              <button
                onClick={() => setActiveFilter("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0",
                  activeFilter === "ALL"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                All ({stats.all})
              </button>
              <button
                onClick={() => setActiveFilter("READY")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0",
                  activeFilter === "READY"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-teal-400 hover:text-teal-300"
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Ready ({stats.ready})
              </button>
              <button
                onClick={() => setActiveFilter("BLOCKED")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0",
                  activeFilter === "BLOCKED"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-rose-400 hover:text-rose-300"
                )}
              >
                <Lock className="h-3.5 w-3.5" />
                Blocked ({stats.blocked})
              </button>
              <button
                onClick={() => setActiveFilter("IN_PROGRESS")}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0",
                  activeFilter === "IN_PROGRESS"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-amber-400 hover:text-amber-300"
                )}
              >
                In Progress ({stats.inProgress})
              </button>
              <button
                onClick={() => setActiveFilter("REVIEW")}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0",
                  activeFilter === "REVIEW"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-purple-400 hover:text-purple-300"
                )}
              >
                Review ({stats.review})
              </button>
              <button
                onClick={() => setActiveFilter("DONE")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0",
                  activeFilter === "DONE"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-emerald-400 hover:text-emerald-300"
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Done ({stats.done})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort tasks by"
                className="rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
              >
                <option value="position">Position / Order</option>
                <option value="title">Title</option>
                <option value="status">Status</option>
                <option value="duration">Duration</option>
                <option value="dueDate">Due Date</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="p-1.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white transition-colors"
                title={`Order: ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {fetchError && (
            <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-rose-400" />
                <span>Unable to connect to the database. Please try again.</span>
              </div>
              <button
                onClick={() => fetchTasks(true)}
                className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="h-9 w-9 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-xs font-semibold text-slate-400">Loading tasks from MongoDB...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-center p-6 space-y-3">
              <Inbox className="h-12 w-12 text-slate-600" />
              <h3 className="text-sm font-semibold text-white">No tasks found</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                {searchQuery
                  ? `No tasks matched "${searchQuery}". Try clearing your search.`
                  : "No tasks found for the selected filter. Create your first task to get started."}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveFilter("ALL");
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create Task</span>
              </button>
            </div>
          )}

          {/* Tasks List */}
          {!isLoading && filteredTasks.length > 0 && (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const isDone = task.status === "DONE";
                const isBlocked = task.isBlocked;
                const isReady = task.isReady && !isDone;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "group rounded-2xl border p-4.5 backdrop-blur-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm",
                      isDone
                        ? "border-emerald-900/30 bg-slate-900/40 opacity-80 hover:opacity-100 hover:border-emerald-700/50"
                        : isBlocked
                        ? "border-rose-900/30 bg-slate-900/60 hover:border-rose-700/50"
                        : isReady
                        ? "border-teal-900/30 bg-slate-900/60 hover:border-teal-700/50"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    )}
                  >
                    {/* Left: Status Indicator & Main Info */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Readiness Icon Pill */}
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        ) : isBlocked ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Lock className="h-4 w-4" />
                          </div>
                        ) : isReady ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
                            <Clock className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            onClick={() => {
                              setSelectedTask(task);
                              setIsDetailModalOpen(true);
                            }}
                            className={cn(
                              "text-sm font-bold cursor-pointer transition-colors hover:text-indigo-400 truncate max-w-md",
                              isDone ? "text-slate-300 line-through decoration-emerald-500/40" : "text-white"
                            )}
                          >
                            {task.title}
                          </h3>

                          {/* Workflow Status Badge */}
                          <span
                            className={cn(
                              "rounded-lg px-2 py-0.5 text-[10px] font-mono font-semibold",
                              task.status === "DONE"
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                                : task.status === "IN_PROGRESS"
                                ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                                : task.status === "REVIEW"
                                ? "bg-purple-950/60 text-purple-400 border border-purple-800/40"
                                : "bg-slate-800 text-slate-300"
                            )}
                          >
                            {task.status.replace("_", " ")}
                          </span>

                          {/* Derived State Badge */}
                          {isBlocked && (
                            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                              BLOCKED
                            </span>
                          )}
                          {isReady && (
                            <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-400 border border-teal-500/20">
                              READY
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-400 line-clamp-1">
                            {task.description}
                          </p>
                        )}

                        {/* Metadata Pills: Dates, Duration, Prerequisites */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                          {task.startDate && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-500" />
                              <span>{formatDate(task.startDate)}</span>
                              {task.dueDate && <span>→ {formatDate(task.dueDate)}</span>}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" />
                            <span>{task.duration || 1} day{(task.duration || 1) > 1 ? "s" : ""}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <GitBranch className="h-3 w-3 text-indigo-400" />
                            <span>
                              {task.dependencyIds?.length || 0} Prerequisite{(task.dependencyIds?.length || 0) === 1 ? "" : "s"}
                            </span>
                          </span>

                          {task.directDownstreamCount ? (
                            <span className="text-indigo-300 font-medium">
                              • Unblocks {task.directDownstreamCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setIsDetailModalOpen(true);
                        }}
                        className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        title="View details and dependencies"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingTask(task);
                          setModalInitialStatus(task.status);
                          setIsTaskModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
                        title="Edit task"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setTaskToDelete(task);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
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
        onEdit={(t) => {
          setEditingTask(t);
          setIsDetailModalOpen(false);
          setIsTaskModalOpen(true);
        }}
        onDelete={(t) => {
          setTaskToDelete(t);
          setIsDetailModalOpen(false);
          setIsDeleteModalOpen(true);
        }}
        onAddDependency={handleAddDependency}
        onRemoveDependency={handleRemoveDependency}
      />

      <DeleteTaskModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          if (taskToDelete) await handleConfirmDelete(taskToDelete.id);
        }}
        task={taskToDelete}
      />
    </div>
  );
}
