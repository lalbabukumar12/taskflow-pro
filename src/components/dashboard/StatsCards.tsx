"use client";

import React from "react";
import {
  Layers,
  Inbox,
  Clock,
  Eye,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { DashboardStats } from "@/types/task";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Total Tasks",
      value: stats.totalTasks,
      subtext: "Pipeline total",
      icon: Layers,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/20",
    },
    {
      label: "Backlog",
      value: stats.backlogTasks,
      subtext: "To be started",
      icon: Inbox,
      color: "text-slate-400",
      bgColor: "bg-slate-500/10",
      borderColor: "border-slate-500/20",
    },
    {
      label: "In Progress",
      value: stats.inProgressTasks,
      subtext: "Active execution",
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
    },
    {
      label: "Review",
      value: stats.reviewTasks,
      subtext: "Quality & QA",
      icon: Eye,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
    },
    {
      label: "Completed",
      value: stats.completedTasks,
      subtext: "Done & verified",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Blocked",
      value: stats.blockedTasks,
      subtext: "Needs prerequisites",
      icon: Lock,
      color: "text-rose-400",
      bgColor: "bg-rose-500/10",
      borderColor: "border-rose-500/20",
    },
    {
      label: "Ready",
      value: stats.readyTasks,
      subtext: "Prereqs satisfied",
      icon: ShieldCheck,
      color: "text-teal-400",
      bgColor: "bg-teal-500/10",
      borderColor: "border-teal-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-xl border ${card.borderColor} bg-slate-900/60 p-3.5 backdrop-blur-md transition-all hover:bg-slate-900/90 hover:border-slate-700/80 hover:shadow-md flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-slate-400 truncate">
                {card.label}
              </span>
              <div className={`rounded-lg p-1.5 ${card.bgColor} ${card.color} shrink-0`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {card.value}
              </span>
              <span className="text-[10px] text-slate-500 font-medium truncate">
                {card.subtext}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
