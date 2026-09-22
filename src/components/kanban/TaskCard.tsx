"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Calendar,
  Lock,
  ShieldCheck,
  GitBranch,
  ArrowRight,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Task } from "@/types/task";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  onViewDetails?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export function TaskCard({
  task,
  isOverlay,
  onViewDetails,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isBlocked = task.isBlocked ?? false;
  const isDone = task.status === "DONE";
  const prereqCount = task.dependencyIds?.length ?? 0;
  const downstreamCount = task.directDownstreamCount ?? 0;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const startDateFormatted = formatDate(task.startDate);
  const dueDateFormatted = formatDate(task.dueDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border p-4 shadow-sm backdrop-blur-md transition-all select-none",
        isDragging
          ? "opacity-30 border-indigo-500/60 bg-indigo-950/20 shadow-none scale-95"
          : "border-slate-800/80 bg-slate-900/90 hover:border-slate-700 hover:shadow-lg hover:shadow-slate-950/50",
        isOverlay &&
          "rotate-1 shadow-2xl border-indigo-500 ring-2 ring-indigo-500/30 bg-slate-900 cursor-grabbing scale-105"
      )}
    >
      {/* Top Row: Dependency State Badge & Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        {/* Computed State Badge: READY vs BLOCKED vs DONE */}
        {isDone ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            <span>DONE</span>
          </span>
        ) : isBlocked ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20"
            title={`${task.blockingPrerequisites?.length || prereqCount} prerequisite(s) pending completion`}
          >
            <Lock className="h-3 w-3 text-rose-400" />
            <span>BLOCKED</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span>READY</span>
          </span>
        )}

        {/* Action Controls & Drag Handle */}
        <div className="flex items-center gap-1">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(task)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="View Details"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}

          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit Task"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(task)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Task"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            {...attributes}
            {...listeners}
            aria-label="Drag handle"
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 opacity-60 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing ml-0.5"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Title & Description */}
      <div
        onClick={() => onViewDetails?.(task)}
        className="cursor-pointer space-y-1"
      >
        <h4 className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-indigo-200 transition-colors line-clamp-2">
          {task.title}
        </h4>
        {task.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Dates Section */}
      {(startDateFormatted || dueDateFormatted) && (
        <div className="flex items-center gap-3 text-[10px] text-slate-400 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
          {startDateFormatted && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-500" />
              <span>Start: {startDateFormatted}</span>
            </div>
          )}
          {dueDateFormatted && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-indigo-400" />
              <span>Due: {dueDateFormatted}</span>
            </div>
          )}
        </div>
      )}

      {/* Dependency Metrics Footer: Prereqs & Dependents */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
        {/* Prerequisites indicator */}
        <div
          className={cn(
            "flex items-center gap-1 font-medium",
            prereqCount === 0
              ? "text-slate-500"
              : isBlocked
              ? "text-rose-400"
              : "text-emerald-400"
          )}
          title={`${prereqCount} prerequisite task(s)`}
        >
          <GitBranch className="h-3 w-3" />
          <span>
            {prereqCount} {prereqCount === 1 ? "prereq" : "prereqs"}
          </span>
        </div>

        {/* Downstream dependents indicator */}
        <div
          className={cn(
            "flex items-center gap-1 font-medium",
            downstreamCount === 0 ? "text-slate-500" : "text-cyan-400"
          )}
          title={`${downstreamCount} downstream dependent task(s)`}
        >
          <ArrowRight className="h-3 w-3" />
          <span>
            {downstreamCount} {downstreamCount === 1 ? "dependent" : "dependents"}
          </span>
        </div>
      </div>
    </div>
  );
}
