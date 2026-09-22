"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Task } from "@/types/task";
import { calculateCriticalPath } from "@/lib/dag/criticalPath";
import { buildDependencyGraph } from "@/lib/dag/graph";
import { useToast } from "@/components/ui/Toast";
import {
  BarChart3,
  Layers,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  Lock,
  ShieldCheck,
  Flame,
  GitBranch,
  TrendingUp,
  RefreshCw,
  GitFork,
  PieChart,
  Calendar,
  AlertCircle,
  ArrowRight,
  Activity,
} from "lucide-react";
import { TaskModal } from "@/components/kanban/TaskModal";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const fetchTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setFetchError(null);

    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to load analytics data");
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

  // Comprehensive analytics calculations from real MongoDB tasks & DAG engine
  const analytics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "DONE").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const review = tasks.filter((t) => t.status === "REVIEW").length;
    const backlog = tasks.filter((t) => t.status === "BACKLOG").length;
    const blocked = tasks.filter((t) => t.isBlocked).length;
    const ready = tasks.filter((t) => t.isReady && t.status !== "DONE").length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const blockedRate = total > 0 ? Math.round((blocked / total) * 100) : 0;
    const readyRate = total > 0 ? Math.round((ready / total) * 100) : 0;

    // Critical Path
    const criticalPathResult = calculateCriticalPath(tasks);

    // DAG Dependency statistics
    const graph = buildDependencyGraph(tasks);
    let totalDependencies = 0;
    let rootTasksCount = 0; // tasks with 0 prerequisites
    let leafTasksCount = 0; // tasks with 0 downstream dependents

    for (const t of tasks) {
      const prereqs = graph.prerequisites.get(t.id) || new Set();
      const downstream = graph.downstream.get(t.id) || new Set();

      totalDependencies += prereqs.size;
      if (prereqs.size === 0) rootTasksCount++;
      if (downstream.size === 0) leafTasksCount++;
    }

    // Duration statistics
    const durations = tasks.map((t) => t.duration || 1);
    const avgDuration =
      durations.length > 0
        ? (durations.reduce((acc, d) => acc + d, 0) / durations.length).toFixed(1)
        : "0.0";

    const avgDurationByStatus = {
      BACKLOG: calculateAvgDuration(tasks.filter((t) => t.status === "BACKLOG")),
      IN_PROGRESS: calculateAvgDuration(tasks.filter((t) => t.status === "IN_PROGRESS")),
      REVIEW: calculateAvgDuration(tasks.filter((t) => t.status === "REVIEW")),
      DONE: calculateAvgDuration(tasks.filter((t) => t.status === "DONE")),
    };

    return {
      total,
      completed,
      inProgress,
      review,
      backlog,
      blocked,
      ready,
      completionRate,
      blockedRate,
      readyRate,
      totalDependencies,
      rootTasksCount,
      leafTasksCount,
      longestChainLength: criticalPathResult.criticalTaskIds.length,
      criticalPathDuration: criticalPathResult.totalDuration,
      criticalPathSequence: criticalPathResult.criticalTasksSequence,
      avgDuration,
      avgDurationByStatus,
    };
  }, [tasks]);

  function calculateAvgDuration(taskList: Task[]): string {
    if (taskList.length === 0) return "0.0";
    const sum = taskList.reduce((acc, t) => acc + (t.duration || 1), 0);
    return (sum / taskList.length).toFixed(1);
  }

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create task");
      showToast("success", "Task Created", `"${taskData.title}" created.`);
      await fetchTasks(false);
      setIsTaskModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating task";
      showToast("error", "Failed", msg);
      throw err;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onNewTask={() => setIsTaskModalOpen(true)} />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {/* Header Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-indigo-400" />
                  Analytics & Workflow Intelligence
                </h1>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                  Real-time DAG Metrics
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Live quantitative analytics calculated from MongoDB tasks, dependency chains, and CPM critical path models.
              </p>
            </div>

            <button
              onClick={() => fetchTasks(false)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50 self-start sm:self-auto"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-indigo-400")} />
              <span>Refresh Metrics</span>
            </button>
          </div>

          {/* Error Banner */}
          {fetchError && (
            <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-rose-400" />
                <span>{fetchError}</span>
              </div>
              <button
                onClick={() => fetchTasks(true)}
                className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500"
              >
                Retry
              </button>
            </div>
          )}

          {/* 7 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="rounded-xl border border-indigo-500/20 bg-slate-900/60 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Total Tasks</span>
                <Layers className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{analytics.total}</div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-slate-900/60 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Completed</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-400">{analytics.completed}</div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">In Progress</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-400">{analytics.inProgress}</div>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-slate-900/60 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Review</span>
                <Eye className="h-4 w-4 text-purple-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-purple-400">{analytics.review}</div>
            </div>

            <div className="rounded-xl border border-slate-500/20 bg-slate-900/60 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Backlog</span>
                <Inbox className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-300">{analytics.backlog}</div>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-slate-900/60 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Blocked</span>
                <Lock className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-rose-400">{analytics.blocked}</div>
            </div>

            <div className="rounded-xl border border-teal-500/20 bg-slate-900/60 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Ready</span>
                <ShieldCheck className="h-4 w-4 text-teal-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-teal-400">{analytics.ready}</div>
            </div>
          </div>

          {/* Charts & Analytical Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart 1: Tasks by Workflow Status */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Workflow Status Distribution</h3>
                </div>
                <span className="text-xs text-slate-400">{analytics.total} Tasks</span>
              </div>

              {/* Visual Bars */}
              <div className="space-y-3 pt-2">
                {[
                  { label: "Backlog", count: analytics.backlog, color: "bg-slate-500", textColor: "text-slate-300" },
                  { label: "In Progress", count: analytics.inProgress, color: "bg-amber-500", textColor: "text-amber-400" },
                  { label: "Review", count: analytics.review, color: "bg-purple-500", textColor: "text-purple-400" },
                  { label: "Done", count: analytics.completed, color: "bg-emerald-500", textColor: "text-emerald-400" },
                ].map((item) => {
                  const pct = analytics.total > 0 ? Math.round((item.count / analytics.total) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{item.label}</span>
                        <span className={cn("font-bold", item.textColor)}>
                          {item.count} <span className="text-[10px] text-slate-500 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                        <div
                          style={{ width: `${pct}%` }}
                          className={cn("h-full rounded-full transition-all duration-500", item.color)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Blocked vs Ready Readiness Gauge */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-400" />
                  <h3 className="text-sm font-bold text-white">Dependency Execution Health</h3>
                </div>
                <span className="text-xs text-slate-400">
                  {analytics.ready + analytics.blocked} Active Tasks
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* Ready Box */}
                <div className="rounded-xl border border-teal-500/20 bg-teal-950/20 p-4 space-y-2 text-center">
                  <div className="inline-flex p-2 rounded-xl bg-teal-500/10 text-teal-400">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="text-2xl font-bold text-teal-300">{analytics.readyRate}%</div>
                  <div className="text-xs font-semibold text-white">Ready to Execute</div>
                  <div className="text-[11px] text-slate-400">{analytics.ready} tasks without blockers</div>
                </div>

                {/* Blocked Box */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 space-y-2 text-center">
                  <div className="inline-flex p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div className="text-2xl font-bold text-rose-300">{analytics.blockedRate}%</div>
                  <div className="text-xs font-semibold text-white">Blocked by Prereqs</div>
                  <div className="text-[11px] text-slate-400">{analytics.blocked} tasks awaiting upstream</div>
                </div>
              </div>

              {/* Progress Distribution Bar */}
              <div className="space-y-1 pt-1">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 flex gap-0.5 p-0.5 border border-slate-800">
                  <div style={{ width: `${analytics.blockedRate}%` }} className="h-full rounded-l-full bg-rose-500" />
                  <div style={{ width: `${analytics.readyRate}%` }} className="h-full bg-teal-400" />
                  <div style={{ width: `${analytics.completionRate}%` }} className="h-full rounded-r-full bg-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Critical Path & Topological DAG Statistics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Critical Path Banner */}
            <div className="lg:col-span-2 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300">
                  <Flame className="h-5 w-5 text-amber-400 animate-pulse" />
                  <h3 className="text-sm font-bold">Critical Path Analysis (CPM)</h3>
                </div>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                  {analytics.criticalPathDuration} Days Total
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                The critical path is the longest dependent task sequence in your DAG. Any schedule delay on these tasks directly postpones project delivery.
              </p>

              {/* Sequence Flow Chips */}
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
                  Critical Path Tasks ({analytics.longestChainLength} Tasks in Chain):
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {analytics.criticalPathSequence.length > 0 ? (
                    analytics.criticalPathSequence.map((title, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-sm">
                          <span>{title}</span>
                        </div>
                        {idx < analytics.criticalPathSequence.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-amber-400 shrink-0" />
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No dependency chain established yet.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Graph Topological Structure Metrics */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">DAG Graph Structure</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-400">Total Dependencies</span>
                  <span className="text-sm font-bold text-indigo-300 font-mono">
                    {analytics.totalDependencies} edges
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-400">Root Tasks (0 Prereqs)</span>
                  <span className="text-sm font-bold text-teal-300 font-mono">
                    {analytics.rootTasksCount} tasks
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-400">Leaf Tasks (Final Deliverables)</span>
                  <span className="text-sm font-bold text-emerald-300 font-mono">
                    {analytics.leafTasksCount} tasks
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Average Task Duration</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {analytics.avgDuration} days
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Average Duration by Status Breakdown */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Average Task Duration by Status</h3>
              </div>
              <span className="text-xs text-slate-400">Mean Duration (Days)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-center">
                <span className="text-[11px] font-semibold text-slate-400 block">Backlog</span>
                <span className="text-xl font-bold text-white mt-1 block">
                  {analytics.avgDurationByStatus.BACKLOG}d
                </span>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3.5 text-center">
                <span className="text-[11px] font-semibold text-amber-400 block">In Progress</span>
                <span className="text-xl font-bold text-amber-300 mt-1 block">
                  {analytics.avgDurationByStatus.IN_PROGRESS}d
                </span>
              </div>
              <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-3.5 text-center">
                <span className="text-[11px] font-semibold text-purple-400 block">Review</span>
                <span className="text-xl font-bold text-purple-300 mt-1 block">
                  {analytics.avgDurationByStatus.REVIEW}d
                </span>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3.5 text-center">
                <span className="text-[11px] font-semibold text-emerald-400 block">Done</span>
                <span className="text-xl font-bold text-emerald-300 mt-1 block">
                  {analytics.avgDurationByStatus.DONE}d
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        allTasks={tasks}
        initialStatus="BACKLOG"
      />
    </div>
  );
}
