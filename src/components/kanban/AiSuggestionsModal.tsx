"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  Check,
  Ban,
  ArrowRight,
  GitBranch,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  KeyRound,
  CheckCheck,
} from "lucide-react";
import { ValidatedAiSuggestion } from "@/lib/ai/dependencySuggestions";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface AiSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDependencyApproved: () => Promise<void>;
}

export function AiSuggestionsModal({
  isOpen,
  onClose,
  onDependencyApproved,
}: AiSuggestionsModalProps) {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ValidatedAiSuggestion[]>([]);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setApprovedIds(new Set());
    setRejectedIds(new Set());

    try {
      const res = await fetch("/api/ai/dependency-suggestions", {
        method: "POST",
      });

      const json = await res.json();

      if (!json.configured) {
        setIsConfigured(false);
        setStatusMessage(json.message || "OpenAI API Key is not configured.");
        setSuggestions([]);
        return;
      }

      setIsConfigured(true);

      if (!json.success) {
        setErrorMessage(json.message || "Failed to generate suggestions.");
        setSuggestions([]);
        return;
      }

      const list: ValidatedAiSuggestion[] = json.data?.suggestions || [];
      setSuggestions(list);
      if (list.length === 0) {
        setStatusMessage("All logical dependencies in your task pipeline are already established!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting AI service";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApprove = async (suggestion: ValidatedAiSuggestion) => {
    setIsProcessingId(suggestion.id);
    try {
      const res = await fetch("/api/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prerequisiteId: suggestion.prerequisiteId,
          dependentId: suggestion.dependentId,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to establish dependency (Status ${res.status})`);
      }

      setApprovedIds((prev) => new Set(prev).add(suggestion.id));
      showToast(
        "success",
        "Dependency Approved & Linked",
        `"${suggestion.prerequisiteTitle}" is now a prerequisite of "${suggestion.dependentTitle}".`
      );

      // Refresh Kanban board
      await onDependencyApproved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve suggestion";
      showToast("error", "Approval Rejected", msg);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleReject = (suggestion: ValidatedAiSuggestion) => {
    setRejectedIds((prev) => new Set(prev).add(suggestion.id));
    showToast("info", "Suggestion Dismissed", "Recommendation skipped.");
  };

  const handleApproveAll = async () => {
    const pending = suggestions.filter(
      (s) => !approvedIds.has(s.id) && !rejectedIds.has(s.id)
    );

    for (const sugg of pending) {
      await handleApprove(sugg);
    }
  };

  const pendingCount = suggestions.filter(
    (s) => !approvedIds.has(s.id) && !rejectedIds.has(s.id)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-indigo-900/40 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  AI-Augmented Dependency Recommendations
                </h2>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                  OpenAI GPT-4o-mini
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Inspect AI-suggested prerequisite links. Each suggestion must be explicitly approved before modifying the database.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-5 space-y-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                <div className="h-9 w-9 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <Sparkles className="h-4 w-4 text-indigo-400 absolute" />
              </div>
              <p className="text-xs font-semibold text-slate-300">
                Analyzing Task Graph with OpenAI...
              </p>
              <p className="text-[11px] text-slate-500">
                Running cycle verification and prerequisite sequence analysis
              </p>
            </div>
          )}

          {/* Missing API Key Guidance State */}
          {!isLoading && !isConfigured && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
              <div className="flex items-center gap-2.5 text-amber-400">
                <KeyRound className="h-5 w-5" />
                <h4 className="text-sm font-semibold">OpenAI API Key Configuration Required</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                To use the AI-Augmented Dependency Suggestion feature, add your OpenAI API Key to{" "}
                <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">
                  .env.local
                </code>
                :
              </p>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-emerald-400 overflow-x-auto">
                OPENAI_API_KEY=sk-proj-...your-key-here...
              </pre>
              <p className="text-[11px] text-slate-400">
                Once configured, restart or click retry to discover AI dependency recommendations.
              </p>
              <button
                onClick={fetchSuggestions}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600/30 border border-amber-500/40 px-3.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-600/40 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {!isLoading && isConfigured && errorMessage && (
            <div className="flex items-start justify-between rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-300">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold block text-rose-200">AI Service Error:</span>
                  <span className="mt-0.5 block leading-relaxed">{errorMessage}</span>
                </div>
              </div>
              <button
                onClick={fetchSuggestions}
                className="shrink-0 rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty / Completed State */}
          {!isLoading && isConfigured && !errorMessage && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-center p-6 space-y-2">
              <ShieldCheck className="h-10 w-10 text-emerald-400" />
              <h4 className="text-sm font-semibold text-white">Pipeline Dependencies Optimized</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                {statusMessage || "All logical prerequisite relationships in your software pipeline are already established."}
              </p>
              <button
                onClick={fetchSuggestions}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Re-scan Tasks</span>
              </button>
            </div>
          )}

          {/* Suggestions List */}
          {!isLoading && isConfigured && suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  Found <strong className="text-white">{suggestions.length}</strong> safe, cycle-verified recommendations:
                </span>
                {pendingCount > 1 && (
                  <button
                    onClick={handleApproveAll}
                    className="flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Approve All ({pendingCount})</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {suggestions.map((sugg) => {
                  const isApproved = approvedIds.has(sugg.id);
                  const isRejected = rejectedIds.has(sugg.id);
                  const isProcessing = isProcessingId === sugg.id;

                  if (isRejected) return null;

                  return (
                    <div
                      key={sugg.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-2xl border p-4 transition-all",
                        isApproved
                          ? "border-emerald-500/30 bg-emerald-950/20 opacity-80"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                      )}
                    >
                      {/* Flow Visualization: Prerequisite -> Dependent */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {/* Prerequisite Node */}
                          <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 border border-slate-800 font-semibold text-slate-200">
                            <span className="text-[10px] text-slate-400 uppercase font-mono">Prereq:</span>
                            <span>{sugg.prerequisiteTitle}</span>
                          </div>

                          <ArrowRight className="h-4 w-4 text-indigo-400 shrink-0" />

                          {/* Dependent Node */}
                          <div className="flex items-center gap-1.5 rounded-xl bg-indigo-950/40 px-3 py-1.5 border border-indigo-500/30 font-semibold text-indigo-200">
                            <span className="text-[10px] text-indigo-400 uppercase font-mono">Dependent:</span>
                            <span>{sugg.dependentTitle}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                              <Check className="h-3.5 w-3.5" />
                              Approved & Linked
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleReject(sugg)}
                                disabled={isProcessing}
                                className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-rose-900/30 hover:bg-rose-950/30 hover:text-rose-300 transition-colors disabled:opacity-50"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                <span>Reject</span>
                              </button>
                              <button
                                onClick={() => handleApprove(sugg)}
                                disabled={isProcessing}
                                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>{isProcessing ? "Linking..." : "Approve"}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Explanation Reason from AI */}
                      <div className="rounded-xl bg-slate-900/80 p-3 text-xs text-slate-300 border border-slate-800/80 leading-relaxed">
                        <span className="font-semibold text-indigo-300">Rationale: </span>
                        {sugg.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>DAG Engine Cycle Verified</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
