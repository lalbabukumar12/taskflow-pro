"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Layers, Inbox } from "lucide-react";
import { Task, TaskStatus } from "@/types/task";
import { TaskCard } from "./TaskCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  accentColor: string;
  borderAccent: string;
  bgTint: string;
  tasks: Task[];
  isLoading?: boolean;
  onAddTask: (status: TaskStatus) => void;
  onViewDetails: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function KanbanColumn({
  id,
  title,
  accentColor,
  borderAccent,
  bgTint,
  tasks,
  isLoading,
  onAddTask,
  onViewDetails,
  onEdit,
  onDelete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: "Column",
      status: id,
    },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col flex-1 min-w-[300px] max-w-[380px] rounded-2xl border bg-slate-900/50 p-3.5 backdrop-blur-xl transition-all duration-200",
        borderAccent,
        isOver
          ? "border-indigo-500/80 bg-indigo-950/20 ring-2 ring-indigo-500/20 scale-[1.01]"
          : "border-slate-800/80"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-1.5 py-1 mb-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", accentColor)} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {title}
          </h3>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-700/60">
            {isLoading ? "..." : tasks.length}
          </span>
        </div>

        <button
          onClick={() => onAddTask(id)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title={`Add task to ${title}`}
          aria-label={`Add task to ${title}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Column Body / Scrollable Cards Area */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-[380px] max-h-[calc(100vh-17rem)] pr-1">
        {isLoading ? (
          // Skeleton Loading State
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-32 w-full rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 animate-pulse space-y-2.5"
              >
                <div className="h-4 w-20 bg-slate-800 rounded-full" />
                <div className="h-4 w-3/4 bg-slate-800 rounded" />
                <div className="h-3 w-1/2 bg-slate-800/60 rounded" />
                <div className="h-6 w-full bg-slate-800/40 rounded mt-3" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/20 p-4 text-center">
            <Inbox className="h-8 w-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-400">No tasks in {title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Drag tasks here or add a new one.</p>
            <button
              onClick={() => onAddTask(id)}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Add Task</span>
            </button>
          </div>
        ) : (
          // Sortable Cards List
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
