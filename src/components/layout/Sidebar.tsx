"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  BarChart3,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Flame,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const navigation = [
    { id: "board", name: "Task Board", icon: FolderKanban, href: "/" },
    { id: "graph", name: "DAG Graph", icon: GitBranch, href: "/graph", badge: "Critical" },
    { id: "tasks", name: "My Tasks", icon: CheckSquare, href: "/tasks" },
    { id: "analytics", name: "Analytics", icon: BarChart3, href: "/analytics" },
    { id: "settings", name: "Settings", icon: Settings, href: "/settings" },
  ];

  const projects = [
    { name: "Frontend App", color: "bg-indigo-500" },
    { name: "API & Microservices", color: "bg-emerald-500" },
    { name: "AI Automation", color: "bg-violet-500" },
  ];

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-slate-800 bg-slate-950/90 backdrop-blur-xl text-slate-200 transition-all duration-300 ease-in-out z-20",
        collapsed ? "w-20" : "w-64",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800/80">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white shadow-lg shadow-indigo-500/20">
            <Flame className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                TaskFlow <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium border border-indigo-500/30">PRO</span>
              </span>
              <span className="text-xs text-slate-400">Workspace Hub</span>
            </div>
          )}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div className="space-y-1">
          {!collapsed && (
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Menu
            </p>
          )}
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = item.href ? pathname === item.href : false;

            const content = (
              <>
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                {!collapsed && (
                  <span className="flex-1 text-left truncate">{item.name}</span>
                )}
                {!collapsed && item.badge && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      isActive
                        ? "bg-indigo-500/30 text-indigo-300"
                        : "bg-slate-800 text-slate-400"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            );

            const btnClass = cn(
              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            );

            if (item.href) {
              return (
                <Link key={item.id} href={item.href} className={btnClass}>
                  {content}
                </Link>
              );
            }

            return (
              <button key={item.id} className={btnClass}>
                {content}
              </button>
            );
          })}
        </div>

        {/* Projects Section */}
        {!collapsed && (
          <div className="space-y-2">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Active Projects
            </p>
            <div className="space-y-1">
              {projects.map((proj, idx) => (
                <button
                  key={idx}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
                >
                  <span className={cn("h-2 w-2 rounded-full", proj.color)} />
                  <span className="truncate">{proj.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Banner */}
      {!collapsed ? (
        <div className="p-3 m-3 rounded-xl bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-indigo-800/40 text-xs">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-1">
            <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
            AI Workflow Ready
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            OpenAI & Mongo integrations configured and ready for intelligence prompts.
          </p>
        </div>
      ) : (
        <div className="p-3 flex justify-center">
          <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/40 text-indigo-400">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
        </div>
      )}
    </aside>
  );
}
