"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Bell,
  Plus,
  SlidersHorizontal,
  Database,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onNewTask?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onOpenFilters?: () => void;
  isFiltersActive?: boolean;
}

export function Header({
  onNewTask,
  searchQuery = "",
  onSearchChange,
  onOpenFilters,
  isFiltersActive = false,
}: HeaderProps) {
  const [dbStatus, setDbStatus] = useState<"connected" | "connecting" | "error">("connecting");

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setDbStatus(data.database === "connected" ? "connected" : "error");
          }
        } else {
          if (isMounted) setDbStatus("error");
        }
      } catch {
        if (isMounted) setDbStatus("error");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 sm:px-6 backdrop-blur-xl">
      {/* Search and Filters */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search tasks, descriptions, or tags... (Press '/' to focus)"
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-10 pr-4 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
        {onOpenFilters && (
          <button
            onClick={onOpenFilters}
            className={cn(
              "hidden md:flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
              isFiltersActive
                ? "border-indigo-500 bg-indigo-600/20 text-indigo-300"
                : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
            title="Filter tasks"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <span>Filters</span>
          </button>
        )}
      </div>

      {/* Right Action Icons & Profile */}
      <div className="flex items-center gap-3">
        {/* Environment Status indicator */}
        <div
          className={cn(
            "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors",
            dbStatus === "connected"
              ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400"
              : dbStatus === "connecting"
              ? "bg-amber-950/30 border-amber-500/30 text-amber-400"
              : "bg-rose-950/30 border-rose-500/30 text-rose-400"
          )}
          title={
            dbStatus === "connected"
              ? "MongoDB Connected via Mongoose"
              : dbStatus === "connecting"
              ? "Checking MongoDB Connection..."
              : "MongoDB Disconnected"
          }
        >
          <Database className="h-3.5 w-3.5" />
          <span>{dbStatus === "connected" ? "MongoDB Live" : dbStatus === "connecting" ? "Checking DB..." : "DB Offline"}</span>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              dbStatus === "connected"
                ? "bg-emerald-400 animate-pulse"
                : dbStatus === "connecting"
                ? "bg-amber-400 animate-ping"
                : "bg-rose-400"
            )}
          />
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
          title="Create a new task in pipeline"
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
