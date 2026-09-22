"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Save,
  Calendar,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle2,
  Lock,
  GitBranch,
} from "lucide-react";
import { Task, TaskStatus } from "@/types/task";
import { wouldCreateCycle } from "@/lib/dag/graph";
import { cn } from "@/lib/utils";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => Promise<void>;
  task?: Task | null; // If provided, edit mode; otherwise create mode
  allTasks: Task[];
  initialStatus?: TaskStatus;
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  task,
  allTasks,
  initialStatus = "BACKLOG",
}: TaskModalProps) {
  const isEditing = Boolean(task);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [duration, setDuration] = useState(1);
  const [selectedPrereqIds, setSelectedPrereqIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state when modal opens or task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setStatus(task.status || "BACKLOG");
      setStartDate(task.startDate ? task.startDate.split("T")[0] : "");
      setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
      setDuration(typeof task.duration === "number" ? task.duration : 1);
      setSelectedPrereqIds(task.dependencyIds || []);
    } else {
      setTitle("");
      setDescription("");
      setStatus(initialStatus);
      const today = new Date().toISOString().split("T")[0];
      setStartDate(today);
      const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      setDueDate(inThreeDays);
      setDuration(3);
      setSelectedPrereqIds([]);
    }
    setFormError(null);
  }, [task, initialStatus, isOpen]);

  if (!isOpen) return null;

  // Candidates for prerequisites (cannot depend on itself)
  const candidateTasks = allTasks.filter(
    (t) => (!task || t.id !== task.id) && t._id !== task?._id
  );

  const handleTogglePrerequisite = (candidateId: string) => {
    setFormError(null);

    if (selectedPrereqIds.includes(candidateId)) {
      setSelectedPrereqIds((prev) => prev.filter((id) => id !== candidateId));
      return;
    }

    // Live cycle detection check if editing existing task
    if (task) {
      const wouldCycle = wouldCreateCycle(allTasks, candidateId, task.id);
      if (wouldCycle) {
        setFormError(
          "Cannot select this task as prerequisite: It would introduce a circular dependency."
        );
        return;
      }
    }

    setSelectedPrereqIds((prev) => [...prev, candidateId]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Task title is required");
      return;
    }

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      setFormError("Start date cannot be after due date");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        duration: Number(duration) || 1,
        dependencyIds: selectedPrereqIds,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save task";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              {isEditing ? <Layers className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {isEditing ? "Edit Task Details" : "Create New Task"}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? "Update specifications, schedule dates, and prerequisite dependencies."
                  : "Add a task to the pipeline and configure its workflow parameters."}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Task Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement Authentication & Session Middleware"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide technical specifications, scope, or acceptance criteria..."
              rows={3}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
            />
          </div>

          {/* Workflow Status & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Workflow Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="BACKLOG">Backlog</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                Duration (Days)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={duration}
                onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value) || 1))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Prerequisites Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
                Prerequisite Tasks ({selectedPrereqIds.length} Selected)
              </span>
              <span className="text-[10px] text-slate-400 lowercase">
                task must wait until prerequisites are DONE
              </span>
            </label>

            <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2 space-y-1.5">
              {candidateTasks.length === 0 ? (
                <p className="p-2 text-center text-xs text-slate-500">
                  No other tasks available to set as prerequisite.
                </p>
              ) : (
                candidateTasks.map((candidate) => {
                  const isSelected = selectedPrereqIds.includes(candidate.id);
                  const isCandidateDone = candidate.status === "DONE";

                  return (
                    <div
                      key={candidate.id}
                      onClick={() => handleTogglePrerequisite(candidate.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg p-2 text-xs transition-colors cursor-pointer border",
                        isSelected
                          ? "border-indigo-500/50 bg-indigo-950/40 text-indigo-200"
                          : "border-slate-800/60 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                        />
                        <span className="truncate font-medium">{candidate.title}</span>
                      </div>

                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                          isCandidateDone
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        )}
                      >
                        {candidate.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Task"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
