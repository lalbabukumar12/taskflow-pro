"use client";

import React from "react";
import {
  Search,
  Bell,
  Plus,
  SlidersHorizontal,
  CheckCircle2,
  Database,
} from "lucide-react";

interface HeaderProps {
  onNewTask?: () => void;
}

export function Header({ onNewTask }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur-xl">
      {/* Search and Filters */}
      <div className="flex items-center gap-4 flex-1 max-w-lg">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks, tags, or team members... (Press '/' to focus)"
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
        <button
          className="hidden md:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          title="Filter tasks"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
          <span>Filters</span>
        </button>
      </div>

      {/* Right Action Icons & Profile */}
      <div className="flex items-center gap-3">
        {/* Environment Status indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <Database className="h-3.5 w-3.5 text-emerald-400" />
          <span>Mongoose Ready</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Notifications */}
        <button
          className="relative rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500" />
        </button>

        {/* New Task Button */}
        <button
          onClick={onNewTask}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Task</span>
        </button>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 p-0.5 shadow-sm">
            <div className="h-full w-full rounded-full bg-slate-950 flex items-center justify-center text-xs font-semibold text-indigo-300">
              TF
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
