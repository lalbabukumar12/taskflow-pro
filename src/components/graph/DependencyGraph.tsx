"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  GitBranch,
  Flame,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  Maximize2,
} from "lucide-react";
import { Task } from "@/types/task";
import { calculateCriticalPath } from "@/lib/dag/criticalPath";
import { cn } from "@/lib/utils";

interface DependencyGraphProps {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
}

interface NodeLayout {
  id: string;
  task: Task;
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EdgeLayout {
  id: string;
  sourceId: string;
  targetId: string;
  source: { x: number; y: number };
  target: { x: number; y: number };
  isCritical: boolean;
  isCompleted: boolean;
  isBlocking: boolean;
}

export function DependencyGraph({ tasks, onSelectTask }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // View settings
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [filterState, setFilterState] = useState<"ALL" | "READY" | "BLOCKED" | "DONE">("ALL");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Critical Path calculation
  const criticalPath = useMemo(() => {
    return calculateCriticalPath(tasks);
  }, [tasks]);

  // Compute Layered DAG Layout (Sugiyama topological levels)
  const { nodes, edges, graphWidth, graphHeight, maxLayer } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return { nodes: [], edges: [], graphWidth: 800, graphHeight: 500, maxLayer: 0 };
    }

    const NODE_WIDTH = 250;
    const NODE_HEIGHT = 115;
    const HORIZONTAL_GAP = 120;
    const VERTICAL_GAP = 50;

    const taskMap = new Map<string, Task>();
    for (const t of tasks) {
      taskMap.set(t.id, t);
    }

    // 1. Calculate topological layer for each node:
    // Layer(v) = 0 if no prereqs, else 1 + max(Layer(u) for u in prereqs)
    const layerMap = new Map<string, number>();

    function getLayer(taskId: string, visited: Set<string>): number {
      if (layerMap.has(taskId)) return layerMap.get(taskId)!;
      if (visited.has(taskId)) return 0; // cycle guard

      visited.add(taskId);
      const t = taskMap.get(taskId);
      if (!t || !t.dependencyIds || t.dependencyIds.length === 0) {
        layerMap.set(taskId, 0);
        return 0;
      }

      let maxPrereqLayer = -1;
      for (const pId of t.dependencyIds) {
        const pLayer = getLayer(pId, new Set(visited));
        if (pLayer > maxPrereqLayer) {
          maxPrereqLayer = pLayer;
        }
      }

      const layer = maxPrereqLayer + 1;
      layerMap.set(taskId, layer);
      return layer;
    }

    for (const t of tasks) {
      getLayer(t.id, new Set());
    }

    // 2. Group nodes by layer
    const layerGroups = new Map<number, Task[]>();
    let maxL = 0;

    for (const t of tasks) {
      const l = layerMap.get(t.id) || 0;
      if (l > maxL) maxL = l;
      if (!layerGroups.has(l)) layerGroups.set(l, []);
      layerGroups.get(l)!.push(t);
    }

    // 3. Compute coordinates for each node
    const nodeLayouts: NodeLayout[] = [];
    const nodePosMap = new Map<string, NodeLayout>();

    let calculatedMaxY = 0;

    for (let l = 0; l <= maxL; l++) {
      const layerTasks = layerGroups.get(l) || [];
      const startX = 60 + l * (NODE_WIDTH + HORIZONTAL_GAP);

      layerTasks.forEach((task, index) => {
        const startY = 60 + index * (NODE_HEIGHT + VERTICAL_GAP);
        if (startY + NODE_HEIGHT > calculatedMaxY) {
          calculatedMaxY = startY + NODE_HEIGHT;
        }

        const layout: NodeLayout = {
          id: task.id,
          task,
          layer: l,
          x: startX,
          y: startY,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        };

        nodeLayouts.push(layout);
        nodePosMap.set(task.id, layout);
      });
    }

    // 4. Compute edge coordinates and visual states
    const edgeLayouts: EdgeLayout[] = [];

    for (const t of tasks) {
      const targetPos = nodePosMap.get(t.id);
      if (!targetPos) continue;

      for (const pId of t.dependencyIds || []) {
        const sourcePos = nodePosMap.get(pId);
        if (!sourcePos) continue;

        const edgeKey = `${pId}->${t.id}`;
        const isCritical = criticalPath.criticalEdgeKeys.has(edgeKey);
        const sourceTask = taskMap.get(pId);
        const isCompleted = sourceTask?.status === "DONE";
        const isBlocking = !isCompleted;

        edgeLayouts.push({
          id: `edge-${pId}-${t.id}`,
          sourceId: pId,
          targetId: t.id,
          source: {
            x: sourcePos.x + sourcePos.width,
            y: sourcePos.y + sourcePos.height / 2,
          },
          target: {
            x: targetPos.x,
            y: targetPos.y + targetPos.height / 2,
          },
          isCritical,
          isCompleted,
          isBlocking,
        });
      }
    }

    const calculatedWidth = 120 + (maxL + 1) * (NODE_WIDTH + HORIZONTAL_GAP);
    const calculatedHeight = Math.max(600, calculatedMaxY + 120);

    return {
      nodes: nodeLayouts,
      edges: edgeLayouts,
      graphWidth: calculatedWidth,
      graphHeight: calculatedHeight,
      maxLayer: maxL,
    };
  }, [tasks, criticalPath]);

  // Handle Pan Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetFit = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  return (
    <div className="flex flex-col h-[750px] w-full rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden shadow-2xl relative">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur-md z-10">
        {/* Left: Title & Metrics */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Interactive DAG Dependency Graph
              </h2>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700">
                {nodes.length} Nodes • {edges.length} Edges • {maxLayer + 1} Depth
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Strict topological visualization. Edges flow from prerequisite (left) to dependent (right).
            </p>
          </div>
        </div>

        {/* Right: Controls & Toggles */}
        <div className="flex items-center gap-2.5">
          {/* Critical Path Toggle */}
          <button
            onClick={() => setShowCriticalPath(!showCriticalPath)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-sm",
              showCriticalPath
                ? "border-amber-500 bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/30"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:border-amber-500/50 hover:text-amber-300"
            )}
            title="Highlight the longest dependency chain based on task durations"
          >
            <Flame className={cn("h-3.5 w-3.5", showCriticalPath && "text-amber-400 animate-pulse")} />
            <span>Critical Path ({criticalPath.totalDuration}d)</span>
          </button>

          {/* Filter Status Selector */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterState("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors text-xs",
                filterState === "ALL" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterState("BLOCKED")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors text-xs",
                filterState === "BLOCKED" ? "bg-rose-600 text-white" : "text-rose-400 hover:text-rose-300"
              )}
            >
              Blocked
            </button>
            <button
              onClick={() => setFilterState("READY")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors text-xs",
                filterState === "READY" ? "bg-teal-600 text-white" : "text-teal-400 hover:text-teal-300"
              )}
            >
              Ready
            </button>
            <button
              onClick={() => setFilterState("DONE")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors text-xs",
                filterState === "DONE" ? "bg-emerald-600 text-white" : "text-emerald-400 hover:text-emerald-300"
              )}
            >
              Done
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-slate-300">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-mono w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
              className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleResetFit}
              className="p-1 rounded-lg hover:bg-slate-800 transition-colors border-l border-slate-800 pl-1.5"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Critical Path Banner Info */}
      {showCriticalPath && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 z-10">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Flame className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="font-semibold text-amber-300 shrink-0">Critical Path Sequence ({criticalPath.totalDuration} days total):</span>
            <div className="flex items-center gap-1.5">
              {criticalPath.criticalTasksSequence.map((title, i) => (
                <React.Fragment key={i}>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-500/30 whitespace-nowrap">
                    {title}
                  </span>
                  {i < criticalPath.criticalTasksSequence.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-amber-400 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          <span className="hidden md:inline text-[11px] text-amber-400/80 shrink-0 font-medium">
            Any delay along this path delays overall delivery
          </span>
        </div>
      )}

      {/* Canvas / SVG Graph Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "flex-1 w-full h-full overflow-hidden select-none bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: graphWidth,
            height: graphHeight,
            position: "relative",
          }}
        >
          {/* SVG Dependency Arrows */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={graphWidth}
            height={graphHeight}
          >
            <defs>
              {/* Standard Slate Arrow Marker */}
              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
              </marker>

              {/* Blocked Rose Arrow Marker */}
              <marker
                id="arrow-blocked"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
              </marker>

              {/* Completed Emerald Arrow Marker */}
              <marker
                id="arrow-completed"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
              </marker>

              {/* Critical Path Glowing Amber Marker */}
              <marker
                id="arrow-critical"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
              </marker>
            </defs>

            {/* Render Edges */}
            {edges.map((edge) => {
              const dx = Math.abs(edge.target.x - edge.source.x);
              const controlPointOffset = Math.max(40, dx * 0.45);

              // Smooth cubic bezier curve from right-center to left-center
              const pathData = `M ${edge.source.x} ${edge.source.y} C ${
                edge.source.x + controlPointOffset
              } ${edge.source.y}, ${edge.target.x - controlPointOffset} ${
                edge.target.y
              }, ${edge.target.x} ${edge.target.y}`;

              const isHighlightedCritical = showCriticalPath && edge.isCritical;

              return (
                <g key={edge.id}>
                  {/* Outer glow line for critical path */}
                  {isHighlightedCritical && (
                    <path
                      d={pathData}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="6"
                      strokeOpacity="0.4"
                      className="animate-pulse"
                    />
                  )}

                  {/* Main Edge Path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={
                      isHighlightedCritical
                        ? "#f59e0b"
                        : edge.isCompleted
                        ? "#10b981"
                        : edge.isBlocking
                        ? "#f43f5e"
                        : "#64748b"
                    }
                    strokeWidth={isHighlightedCritical ? 3 : 2}
                    strokeDasharray={
                      !edge.isCompleted && !isHighlightedCritical ? "4 4" : undefined
                    }
                    markerEnd={`url(#${
                      isHighlightedCritical
                        ? "arrow-critical"
                        : edge.isCompleted
                        ? "arrow-completed"
                        : edge.isBlocking
                        ? "arrow-blocked"
                        : "arrow-default"
                    })`}
                    className="transition-all duration-300"
                  />
                </g>
              );
            })}
          </svg>

          {/* Render Task Nodes */}
          {nodes.map((node) => {
            const task = node.task;
            const isCritical = criticalPath.criticalTaskIds.includes(task.id);
            const isCriticalHighlighted = showCriticalPath && isCritical;

            // Filter visibility
            if (filterState === "BLOCKED" && !task.isBlocked) return null;
            if (filterState === "READY" && (!task.isReady || task.status === "DONE")) return null;
            if (filterState === "DONE" && task.status !== "DONE") return null;

            // Visual indicator styling
            const isDone = task.status === "DONE";
            const isBlocked = task.isBlocked;
            const isReady = task.isReady && !isDone;

            return (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTask?.(task);
                }}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                }}
                className={cn(
                  "group rounded-2xl border p-3.5 backdrop-blur-md transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-lg hover:scale-[1.02]",
                  isCriticalHighlighted
                    ? "border-amber-400 bg-amber-950/30 ring-2 ring-amber-500/50 shadow-amber-500/10"
                    : isDone
                    ? "border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-500"
                    : isBlocked
                    ? "border-rose-500/40 bg-rose-950/20 hover:border-rose-500"
                    : isReady
                    ? "border-teal-500/40 bg-teal-950/20 hover:border-teal-500"
                    : "border-slate-800 bg-slate-900/90 hover:border-slate-700"
                )}
              >
                {/* Node Header: Status & Readiness */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    {isDone ? (
                      <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        DONE
                      </span>
                    ) : isBlocked ? (
                      <span className="flex items-center gap-1 rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/30">
                        <Lock className="h-3 w-3" />
                        BLOCKED
                      </span>
                    ) : isReady ? (
                      <span className="flex items-center gap-1 rounded-md bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-teal-400 border border-teal-500/30">
                        <ShieldCheck className="h-3 w-3" />
                        READY
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                        {task.status}
                      </span>
                    )}

                    {isCriticalHighlighted && (
                      <span className="flex items-center gap-0.5 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40 animate-pulse">
                        <Flame className="h-3 w-3 text-amber-400" />
                        CRITICAL
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {task.duration || 1}d
                  </span>
                </div>

                {/* Node Body: Title */}
                <div className="my-1">
                  <h4
                    className={cn(
                      "text-xs font-bold leading-snug line-clamp-2 transition-colors",
                      isDone
                        ? "text-slate-300 line-through decoration-emerald-500/40"
                        : "text-white group-hover:text-indigo-300"
                    )}
                  >
                    {task.title}
                  </h4>
                </div>

                {/* Node Footer: Prereqs & Dependents */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-slate-500">Prereqs:</span>
                    <strong className="text-slate-300 font-mono">
                      {task.dependencyIds?.length || 0}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-slate-500">Unlocks:</span>
                    <strong className="text-slate-300 font-mono">
                      {task.directDownstreamCount || 0}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Legend Bar */}
      <div className="flex flex-wrap items-center justify-between border-t border-slate-800 bg-slate-900/90 px-4 py-2 text-[11px] text-slate-400 z-10">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Completed (Resolved Prereq)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400" />
            <span>Ready (All Prereqs Done)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Blocked (Waiting for Prereq)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Critical Path (Longest Duration Chain)</span>
          </span>
        </div>

        <span className="text-[10px] text-slate-500">
          Drag canvas to pan • Scroll/buttons to zoom • Click node to inspect
        </span>
      </div>
    </div>
  );
}
