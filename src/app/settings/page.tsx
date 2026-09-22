"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useToast } from "@/components/ui/Toast";
import {
  Settings as SettingsIcon,
  Save,
  Sparkles,
  Database,
  Info,
  Sliders,
  Palette,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Layers,
  ShieldCheck,
  Building,
} from "lucide-react";
import { TaskModal } from "@/components/kanban/TaskModal";
import { Task } from "@/types/task";
import { cn } from "@/lib/utils";

interface SettingsState {
  workspaceName: string;
  workspaceDescription: string;
  theme: "dark" | "light" | "system";
  layoutPreference: "compact" | "comfortable";
  defaultTaskStatus: "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE";
  defaultTaskDuration: number;
  system: {
    aiConfigured: boolean;
    databaseStatus: string;
    appName: string;
    version: string;
    techStack: string;
  };
}

export default function SettingsPage() {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings form state
  const [workspaceName, setWorkspaceName] = useState("Engineering Core Workspace");
  const [workspaceDescription, setWorkspaceDescription] = useState(
    "Mission-critical DAG project pipeline and dependency orchestration."
  );
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [layoutPreference, setLayoutPreference] = useState<"compact" | "comfortable">("comfortable");
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<
    "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE"
  >("BACKLOG");
  const [defaultTaskDuration, setDefaultTaskDuration] = useState(3);

  // System metadata (Safe runtime flags)
  const [systemInfo, setSystemInfo] = useState({
    aiConfigured: false,
    databaseStatus: "connected",
    appName: "TaskFlow Pro",
    version: "1.0.0",
    techStack: "Next.js 16 (App Router) • TypeScript 5 • MongoDB (Mongoose) • Tailwind CSS v4 • @dnd-kit",
  });

  // Fetch settings from API
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setWorkspaceName(d.workspaceName || "Engineering Core Workspace");
        setWorkspaceDescription(d.workspaceDescription || "");
        setTheme(d.theme || "dark");
        setLayoutPreference(d.layoutPreference || "comfortable");
        setDefaultTaskStatus(d.defaultTaskStatus || "BACKLOG");
        setDefaultTaskDuration(d.defaultTaskDuration || 3);
        if (d.system) {
          setSystemInfo(d.system);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading settings";
      showToast("error", "Settings Load Error", msg);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName,
          workspaceDescription,
          theme,
          layoutPreference,
          defaultTaskStatus,
          defaultTaskDuration,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save settings");
      }

      showToast("success", "Settings Saved", "Your workspace settings have been updated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      showToast("error", "Error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setAllTasks(json.data);
      })
      .catch(() => {});
  }, [isTaskModalOpen]);

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create task");
      showToast("success", "Task Created", `"${taskData.title}" created.`);
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

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <SettingsIcon className="h-6 w-6 text-indigo-400" />
                  Workspace Settings
                </h1>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                  Global Configuration
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Manage workspace defaults, UI preferences, and view runtime infrastructure status.
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors disabled:opacity-50 self-start sm:self-auto"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="h-9 w-9 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-xs font-semibold text-slate-400">Loading settings...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
              {/* 1. GENERAL */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 backdrop-blur-md">
                <div className="flex items-center gap-2 text-white border-b border-slate-800 pb-3">
                  <Building className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold">General Workspace Info</h3>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="e.g. Engineering Core Workspace"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Workspace Description
                    </label>
                    <textarea
                      rows={2}
                      value={workspaceDescription}
                      onChange={(e) => setWorkspaceDescription(e.target.value)}
                      placeholder="Describe the primary goals or team focus..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. APPEARANCE */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 backdrop-blur-md">
                <div className="flex items-center gap-2 text-white border-b border-slate-800 pb-3">
                  <Palette className="h-4 w-4 text-purple-400" />
                  <h3 className="text-sm font-bold">Appearance & Layout</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Theme Preference
                    </label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as any)}
                      aria-label="Theme Preference"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="dark">Dark Theme (Pro Default)</option>
                      <option value="light">Light Theme</option>
                      <option value="system">Follow System</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Board Layout Style
                    </label>
                    <select
                      value={layoutPreference}
                      onChange={(e) => setLayoutPreference(e.target.value as any)}
                      aria-label="Board Layout Style"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="comfortable">Comfortable (Detailed metadata)</option>
                      <option value="compact">Compact (Dense card view)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. WORKFLOW DEFAULTS */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 backdrop-blur-md">
                <div className="flex items-center gap-2 text-white border-b border-slate-800 pb-3">
                  <Sliders className="h-4 w-4 text-teal-400" />
                  <h3 className="text-sm font-bold">Workflow & Task Defaults</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Default Initial Task Status
                    </label>
                    <select
                      value={defaultTaskStatus}
                      onChange={(e) => setDefaultTaskStatus(e.target.value as any)}
                      aria-label="Default Initial Task Status"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="BACKLOG">Backlog</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="REVIEW">Review</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Default Task Duration (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={defaultTaskDuration}
                      onChange={(e) => setDefaultTaskDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs sm:text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 4. AI INTEGRATION STATUS */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 backdrop-blur-md">
                <div className="flex items-center gap-2 text-white border-b border-slate-800 pb-3">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold">AI Intelligence Integration</h3>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/70">
                  <div className="flex items-center gap-3">
                    {systemInfo.aiConfigured ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <XCircle className="h-4 w-4" />
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        {systemInfo.aiConfigured
                          ? "AI integration configured"
                          : "AI integration not configured"}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {systemInfo.aiConfigured
                          ? "OpenAI gpt-4o-mini server module active for dependency recommendations."
                          : "Add OPENAI_API_KEY to your .env.local file to enable AI suggestions."}
                      </div>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold border",
                      systemInfo.aiConfigured
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    )}
                  >
                    {systemInfo.aiConfigured ? "Active" : "Unconfigured"}
                  </span>
                </div>
              </div>

              {/* 5. DATABASE CONNECTION STATUS */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 backdrop-blur-md">
                <div className="flex items-center gap-2 text-white border-b border-slate-800 pb-3">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold">Database Health</h3>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/70">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">MongoDB Connected</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Mongoose connection pool active with transactional DAG persistence.
                      </div>
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                    Online
                  </span>
                </div>
              </div>

              {/* 6. ABOUT */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 backdrop-blur-md">
                <div className="flex items-center gap-2 text-white border-b border-slate-800 pb-3">
                  <Info className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-bold">About TaskFlow Pro</h3>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Application Name:</span>
                    <span className="font-semibold text-white">{systemInfo.appName}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Version:</span>
                    <span className="font-mono text-indigo-400">{systemInfo.version}</span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-slate-400">Tech Stack:</span>
                    <span className="text-right text-[11px] text-slate-300 max-w-md">
                      {systemInfo.techStack}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Submit */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? "Saving Changes..." : "Save Workspace Settings"}</span>
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleCreateTask}
        allTasks={allTasks}
        initialStatus="BACKLOG"
      />
    </div>
  );
}
