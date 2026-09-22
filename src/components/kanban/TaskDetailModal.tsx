"use client";

import React, { useState } from "react";
import {
  X,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
  GitBranch,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Unlink,
  Plus,
  AlertCircle,
  Link as LinkIcon,
} from "lucide-react";
import { Task } from "@/types/task";
import { wouldCreateCycle } from "@/lib/dag/graph";
import { cn } from "@/lib/utils";

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  allTasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddDependency: (prerequisiteId: string, dependentId: string) => Promise<void>;
  onRemoveDependency: (prerequisiteId: string, dependentId: string) => Promise<void>;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  allTasks,
  onEdit,
  onDelete,
  onAddDependency,
  onRemoveDependency,
}: TaskDetailModalProps) {
  const [isAddingPrereq, setIsAddingPrereq] = useState(false);
  const [selectedPrereqId, setSelectedPrereqId] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  // Prerequisite tasks details from allTasks
  const prereqIds = task.dependencyIds || [];
  const prereqTasks = allTasks.filter((t) => prereqIds.includes(t.id));
  const completedPrereqs = prereqTasks.filter((t) => t.status === "DONE");
  const blockingPrereqs = prereqTasks.filter((t) => t.status !== "DONE");

  // Downstream tasks (tasks that have this task in their dependencyIds)
  const downstreamTasks = allTasks.filter((t) => t.dependencyIds?.includes(task.id));

  const isBlocked = blockingPrereqs.length > 0;
  const isDone = task.status === "DONE";

  // Candidate tasks for adding as new prerequisites:
  // 1. Exclude self
  // 2. Exclude already linked prerequisites
  const availableCandidates = allTasks
    .filter((t) => t.id !== task.id && !prereqIds.includes(t.id))
    .map((candidate) => {
      const createsCycle = wouldCreateCycle(allTasks, candidate.id, task.id);
      return {
        ...candidate,
        createsCycle,
      };
    });

  const handleAddPrerequisiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!selectedPrereqId) {
      setActionError("Please select a task from the list to add as prerequisite.");
      return;
    }

    const candidate = availableCandidates.find((c) => c.id === selectedPrereqId);
    if (candidate?.createsCycle) {
      setActionError(
        `Cannot add "${candidate.title}": This would create a circular dependency cycle in the project graph.`
      );
      return;
    }

    try {
      setIsSubmittingAdd(true);
      await onAddDependency(selectedPrereqId, task.id);
      setSelectedPrereqId("");
      setIsAddingPrereq(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add dependency";
      setActionError(message);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleUnlink = async (prereqId: string) => {
    setActionError(null);
    try {
      setIsUnlinking(prereqId);
      await onRemoveDependency(prereqId, task.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove dependency";
      setActionError(message);
    } finally {
      setIsUnlinking(null);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Not set";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white leading-tight">
                  {task.title}
                </h2>
                {/* Workflow Status Badge */}
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-700">
                  {task.status}
                </span>
                {/* Computed Readiness Badge */}
                {isDone ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completed
                  </span>
                ) : isBlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
                    <Lock className="h-3.5 w-3.5" />
                    BLOCKED ({blockingPrereqs.length} pending)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    READY to Work
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Task ID: <code className="text-slate-300 font-mono text-[11px]">{task.id}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onClose();
                onEdit(task);
              }}
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              title="Edit Task Details"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                onClose();
                onDelete(task);
              }}
              className="rounded-lg border border-rose-900/30 bg-rose-950/20 p-2 text-rose-400 hover:bg-rose-900/40 hover:text-rose-200 transition-colors"
              title="Delete Task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {actionError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/50 p-3 text-xs text-rose-300 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-rose-200">Dependency Action Rejected:</span>
              <span className="mt-0.5 block leading-relaxed">{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-400 hover:text-rose-200 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="mt-5 space-y-6">
          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Description
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 whitespace-pre-wrap">
              {task.description || "No description provided."}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                Start Date
              </span>
              <p className="mt-1 text-xs font-semibold text-white">
                {formatDate(task.startDate)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                Due Date
              </span>
              <p className="mt-1 text-xs font-semibold text-white">
                {formatDate(task.dueDate)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                Duration
              </span>
              <p className="mt-1 text-xs font-semibold text-white">
                {task.duration ?? 1} Days
              </p>
            </div>
          </div>

          {/* Dependency Management Section */}
          <div className="space-y-4">
            {/* 1. Prerequisites Management Section */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-indigo-400" />
                    Prerequisites ({prereqTasks.length})
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tasks that MUST be completed before this task can become READY.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {prereqTasks.length > 0 && (
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700">
                      {completedPrereqs.length}/{prereqTasks.length} Done ({task.readinessPercentage ?? 0}%)
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setIsAddingPrereq(!isAddingPrereq);
                      setActionError(null);
                    }}
                    className="flex items-center gap-1 rounded-xl bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 hover:text-white transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isAddingPrereq ? "Cancel" : "Add Prerequisite"}</span>
                  </button>
                </div>
              </div>

              {/* Add Prerequisite Form */}
              {isAddingPrereq && (
                <form
                  onSubmit={handleAddPrerequisiteSubmit}
                  className="mb-4 rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 space-y-3 animate-in fade-in"
                >
                  <label className="block text-xs font-semibold text-indigo-200">
                    Select an available task to depend on:
                  </label>

                  <select
                    value={selectedPrereqId}
                    onChange={(e) => {
                      setSelectedPrereqId(e.target.value);
                      setActionError(null);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Prerequisite Task --</option>
                    {availableCandidates.map((candidate) => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                        disabled={candidate.createsCycle}
                      >
                        {candidate.title} [{candidate.status}]
                        {candidate.createsCycle ? " ⚠️ (Causes Circular Cycle)" : ""}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingPrereq(false)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAdd || !selectedPrereqId}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      <span>{isSubmittingAdd ? "Linking..." : "Link Prerequisite"}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Prerequisites List */}
              {prereqTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800/80 p-4 text-center text-xs text-slate-400">
                  <p>This task has no prerequisites. It is unblocked and can be worked on immediately.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {prereqTasks.map((prereq) => {
                    const isPrereqDone = prereq.status === "DONE";
                    return (
                      <div
                        key={prereq.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border p-3 text-xs transition-colors",
                          isPrereqDone
                            ? "border-emerald-500/20 bg-emerald-950/20 text-slate-200"
                            : "border-rose-500/20 bg-rose-950/20 text-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {isPrereqDone ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                          )}
                          <div className="truncate">
                            <span className="font-semibold text-white block truncate">
                              {prereq.title}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Status: {prereq.status} • {isPrereqDone ? "Completed" : "Blocking this task"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                              isPrereqDone
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            )}
                          >
                            {isPrereqDone ? "Done" : "Blocking"}
                          </span>
                          <button
                            onClick={() => handleUnlink(prereq.id)}
                            disabled={isUnlinking === prereq.id}
                            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-slate-400 hover:border-rose-500/30 hover:bg-rose-950/40 hover:text-rose-300 transition-colors disabled:opacity-50"
                            title="Remove this prerequisite"
                          >
                            <Unlink className="h-3 w-3" />
                            <span>{isUnlinking === prereq.id ? "Unlinking..." : "Unlink"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Downstream Dependents Section */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-cyan-400" />
                    Downstream Dependents ({downstreamTasks.length})
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tasks that depend on this task completing first.
                  </p>
                </div>
              </div>

              {downstreamTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800/80 p-4 text-center text-xs text-slate-400">
                  <p>No other tasks currently depend on this task.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {downstreamTasks.map((downstream) => (
                    <div
                      key={downstream.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-white block truncate">
                          {downstream.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Status: {downstream.status}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700">
                        {downstream.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
