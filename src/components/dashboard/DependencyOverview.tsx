"use client";

import React, { useState } from "react";
import {
  GitBranch,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  AlertOctagon,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Task } from "@/types/task";
import { cn } from "@/lib/utils";

interface DependencyOverviewProps {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
}

export function DependencyOverview({ tasks, onSelectTask }: DependencyOverviewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "BLOCKED" | "READY" | "COMPLETED">("ALL");

  const blockedTasks = tasks.filter((t) => t.isBlocked);
  const readyTasks = tasks.filter((t) => t.isReady && t.status !== "DONE");
  const completedTasks = tasks.filter((t) => t.status === "DONE");

  const total = tasks.length || 1;
  const blockedPercent = Math.round((blockedTasks.length / total) * 100);
  const readyPercent = Math.round((readyTasks.length / total) * 100);
  const completedPercent = Math.round((completedTasks.length / total) * 100);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md transition-all">
      {/* Header & Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Dependency Overview & Graph Health
              </h3>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                {tasks.length} Tasks
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live prerequisite status distribution and execution readiness across your DAG.
            </p>
          </div>
        </div>

        {/* Tab Filters & Collapse Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors text-xs",
                activeTab === "ALL"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab("BLOCKED")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors text-xs",
                activeTab === "BLOCKED"
                  ? "bg-rose-600/90 text-white shadow-sm"
                  : "text-rose-400 hover:text-rose-300"
              )}
            >
              <Lock className="h-3 w-3" />
              Blocked ({blockedTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("READY")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors text-xs",
                activeTab === "READY"
                  ? "bg-teal-600/90 text-white shadow-sm"
                  : "text-teal-400 hover:text-teal-300"
              )}
            >
              <ShieldCheck className="h-3 w-3" />
              Ready ({readyTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("COMPLETED")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors text-xs",
                activeTab === "COMPLETED"
                  ? "bg-emerald-600/90 text-white shadow-sm"
                  : "text-emerald-400 hover:text-emerald-300"
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              Done ({completedTasks.length})
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isExpanded ? "Collapse Overview" : "Expand Overview"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Progress Distribution Segmented Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 px-0.5">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Blocked: <strong className="text-white">{blockedPercent}%</strong> ({blockedTasks.length})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-400" />
                Ready to Work: <strong className="text-white">{readyPercent}%</strong> ({readyTasks.length})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Completed: <strong className="text-white">{completedPercent}%</strong> ({completedTasks.length})
              </span>
            </div>

            {/* Segmented Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 flex gap-0.5 p-0.5 border border-slate-800">
              <div
                style={{ width: `${blockedPercent}%` }}
                className="h-full rounded-l-full bg-rose-500 transition-all duration-500"
                title={`Blocked: ${blockedTasks.length} tasks`}
              />
              <div
                style={{ width: `${readyPercent}%` }}
                className="h-full bg-teal-400 transition-all duration-500"
                title={`Ready: ${readyTasks.length} tasks`}
              />
              <div
                style={{ width: `${completedPercent}%` }}
                className="h-full rounded-r-full bg-emerald-500 transition-all duration-500"
                title={`Completed: ${completedTasks.length} tasks`}
              />
            </div>
          </div>

          {/* 3 Categories / Detailed Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Category 1: Blocked Tasks */}
            {(activeTab === "ALL" || activeTab === "BLOCKED") && (
              <div className="rounded-xl border border-rose-900/30 bg-rose-950/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <Lock className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Blocked Tasks</span>
                  </div>
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
                    {blockedTasks.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {blockedTasks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No blocked tasks. Pipeline is moving smoothly!
                    </div>
                  ) : (
                    blockedTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask?.(t)}
                        className="rounded-lg border border-rose-900/40 bg-slate-900/80 p-2.5 hover:border-rose-700/60 transition-all cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-semibold text-white line-clamp-1">
                            {t.title}
                          </span>
                          <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                            {t.status}
                          </span>
                        </div>

                        {/* Blocking Prerequisites Badges */}
                        <div className="space-y-1">
                          {t.blockingPrerequisites && t.blockingPrerequisites.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="text-rose-400 font-medium">Awaiting:</span>
                              {t.blockingPrerequisites.map((bp) => (
                                <span
                                  key={bp.id}
                                  className="inline-flex items-center gap-1 rounded bg-rose-950/60 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-800/40"
                                >
                                  <AlertOctagon className="h-2.5 w-2.5" />
                                  <span className="truncate max-w-[120px]">{bp.title}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-rose-400">
                              Waiting for {t.dependencyIds.length} prerequisite(s)
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Category 2: Ready Tasks */}
            {(activeTab === "ALL" || activeTab === "READY") && (
              <div className="rounded-xl border border-teal-900/30 bg-teal-950/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-teal-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Ready to Work</span>
                  </div>
                  <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-400 border border-teal-500/20">
                    {readyTasks.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {readyTasks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No pending ready tasks.
                    </div>
                  ) : (
                    readyTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask?.(t)}
                        className="rounded-lg border border-teal-900/40 bg-slate-900/80 p-2.5 hover:border-teal-700/60 transition-all cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-semibold text-white line-clamp-1">
                            {t.title}
                          </span>
                          <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                            {t.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="inline-flex items-center gap-1 text-teal-300 font-medium">
                            <Check className="h-3 w-3" />
                            {t.dependencyIds.length === 0
                              ? "No prerequisites (Root task)"
                              : `All ${t.dependencyIds.length} prerequisite(s) completed`}
                          </span>
                          {t.directDownstreamCount ? (
                            <span className="text-slate-500">
                              Unblocks {t.directDownstreamCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Category 3: Completed Tasks */}
            {(activeTab === "ALL" || activeTab === "COMPLETED") && (
              <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Completed Tasks</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    {completedTasks.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {completedTasks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No tasks completed yet.
                    </div>
                  ) : (
                    completedTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask?.(t)}
                        className="rounded-lg border border-emerald-900/40 bg-slate-900/80 p-2.5 hover:border-emerald-700/60 transition-all cursor-pointer space-y-1.5 opacity-90 hover:opacity-100"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-semibold text-slate-200 line-clamp-1 line-through decoration-emerald-500/40">
                            {t.title}
                          </span>
                          <span className="shrink-0 rounded bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 border border-emerald-800/40">
                            DONE
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="text-emerald-400/90 font-medium">
                            Unlocked downstream workflow
                          </span>
                          {t.directDownstreamCount ? (
                            <span className="text-slate-500">
                              {t.directDownstreamCount} dependent(s)
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
