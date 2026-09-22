"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Task } from "@/types/task";

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  task: Task | null;
}

export function DeleteTaskModal({
  isOpen,
  onClose,
  onConfirm,
  task,
}: DeleteTaskModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !task) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onConfirm();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-rose-900/30 bg-slate-900 p-6 shadow-2xl text-slate-100">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">Delete Task</h3>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-white">"{task.title}"</span>?
            </p>
            <p className="mt-2 rounded-xl bg-slate-950/60 p-2.5 text-[11px] text-slate-400 border border-slate-800">
              ℹ️ Any downstream tasks depending on this task will be automatically unlinked safely without breaking the DAG.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isDeleting ? "Deleting..." : "Delete Task"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
