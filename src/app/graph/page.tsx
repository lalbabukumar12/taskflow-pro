"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";
import { TaskModal } from "@/components/kanban/TaskModal";
import { DeleteTaskModal } from "@/components/kanban/DeleteTaskModal";
import { Task, TaskStatus } from "@/types/task";
import { useToast } from "@/components/ui/Toast";
import { GitFork, ShieldCheck, Flame, RefreshCw, ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

export default function GraphPage() {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to load tasks");
      const json = await res.json();
      setTasks(json.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error connecting to server";
      showToast("error", "Database Error", msg);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        const res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to update task");
        }
        showToast("success", "Task Updated", `"${taskData.title}" updated.`);
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to create task");
        }
        showToast("success", "Task Created", `"${taskData.title}" created.`);
      }

      await fetchTasks();
      setIsTaskModalOpen(false);
      setEditingTask(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      showToast("error", "Save Failed", msg);
      throw err;
    }
  };

  const handleConfirmDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete task");
      }
      showToast("success", "Task Deleted", "The task was removed.");
      await fetchTasks();
      setIsDeleteModalOpen(false);
      setTaskToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete task";
      showToast("error", "Delete Failed", msg);
      throw err;
    }
  };

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
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to add dependency");
      showToast("success", "Dependency Established", "Graph updated successfully.");
      await fetchTasks();
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
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to remove dependency");
      showToast("info", "Dependency Removed", "Graph updated successfully.");
      await fetchTasks();
      if (json.data?.dependentTask) {
        setSelectedTask(json.data.dependentTask);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove dependency";
      showToast("error", "Error", msg);
      throw err;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onNewTask={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {/* Header Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Back to Kanban Board"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    DAG Dependency Graph & Critical Path
                  </h1>
                  <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                    Interactive Visualization
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Topological node-edge graph showing prerequisite flows, blocked states, and duration-weighted critical path.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchTasks}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
                <span>Refresh Graph</span>
              </button>

              <button
                onClick={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/30"
              >
                <Plus className="h-4 w-4" />
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Main Graph Canvas Component */}
          <DependencyGraph tasks={tasks} onSelectTask={handleSelectTask} />
        </main>
      </div>

      {/* Task Creation & Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        task={editingTask}
        allTasks={tasks}
        initialStatus="BACKLOG"
      />

      {/* Task Detail Modal for Graph Inspection */}
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

      {/* Delete Confirmation Modal */}
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
