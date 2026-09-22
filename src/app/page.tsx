"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { DependencyOverview } from "@/components/dashboard/DependencyOverview";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { DependencyGraph } from "@/components/graph/DependencyGraph";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";
import { TaskModal } from "@/components/kanban/TaskModal";
import { DeleteTaskModal } from "@/components/kanban/DeleteTaskModal";
import { Task } from "@/types/task";
import { useToast } from "@/components/ui/Toast";
import {
  GitFork,
  ShieldCheck,
  FolderKanban,
  GitBranch,
  Flame,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<"BOARD" | "GRAPH">("BOARD");

  // Modals for graph selection
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const json = await res.json();
        setTasks(json.data || []);
      }
    } catch {
      // handled in board
    }
  }, []);

  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const backlogTasks = tasks.filter((t) => t.status === "BACKLOG").length;
    const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const reviewTasks = tasks.filter((t) => t.status === "REVIEW").length;
    const completedTasks = tasks.filter((t) => t.status === "DONE").length;
    const blockedTasks = tasks.filter((t) => t.isBlocked).length;
    const readyTasks = tasks.filter((t) => t.isReady && t.status !== "DONE").length;

    return {
      totalTasks,
      backlogTasks,
      inProgressTasks,
      reviewTasks,
      completedTasks,
      blockedTasks,
      readyTasks,
    };
  }, [tasks]);

  const handleSelectTaskFromGraph = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
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
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Scrollable Dashboard View */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {/* Dashboard Title & Active Sprint Indicator */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Sprint Pipeline & Dependency Flow
                </h1>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                  Sprint #1 Active
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Manage workflow statuses, resolve dependencies, and inspect topological DAG flows.
              </p>
            </div>

            {/* View Switcher Tabs & Engine Badges */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveView("BOARD")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all",
                    activeView === "BOARD"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  <span>Kanban Board</span>
                </button>
                <button
                  onClick={() => setActiveView("GRAPH")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all",
                    activeView === "GRAPH"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>DAG Graph & Critical Path</span>
                </button>
              </div>
            </div>
          </div>

          {/* 7 Summary Metrics Cards */}
          <StatsCards stats={stats} />

          {/* Dependency Overview Section */}
          <DependencyOverview tasks={tasks} onSelectTask={handleSelectTaskFromGraph} />

          {/* Active View: Kanban Board vs Dependency Graph */}
          {activeView === "BOARD" ? (
            <div className="space-y-2">
              <KanbanBoard onTasksUpdate={setTasks} />
            </div>
          ) : (
            <div className="space-y-2">
              <DependencyGraph tasks={tasks} onSelectTask={handleSelectTaskFromGraph} />
            </div>
          )}
        </main>
      </div>

      {/* Task Detail Modal for Graph Inspections */}
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
    </div>
  );
}
