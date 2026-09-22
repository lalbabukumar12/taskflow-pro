"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, description?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, description?: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastMessage = { id, type, title, description, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 fade-in duration-200",
              toast.type === "success" &&
                "border-emerald-500/30 bg-emerald-950/90 text-emerald-100 shadow-emerald-950/40",
              toast.type === "error" &&
                "border-rose-500/30 bg-rose-950/90 text-rose-100 shadow-rose-950/40",
              toast.type === "warning" &&
                "border-amber-500/30 bg-amber-950/90 text-amber-100 shadow-amber-950/40",
              toast.type === "info" &&
                "border-indigo-500/30 bg-slate-900/95 text-slate-100 shadow-indigo-950/40"
            )}
          >
            {/* Icon */}
            <div className="mt-0.5 shrink-0">
              {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
              {toast.type === "error" && <XCircle className="h-5 w-5 text-rose-400" />}
              {toast.type === "warning" && <AlertTriangle className="h-5 w-5 text-amber-400" />}
              {toast.type === "info" && <Info className="h-5 w-5 text-indigo-400" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-semibold leading-snug">{toast.title}</h5>
              {toast.description && (
                <p className="mt-1 text-[11px] opacity-80 leading-relaxed break-words">
                  {toast.description}
                </p>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeToast(toast.id)}
              className="rounded-lg p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-white/10"
              aria-label="Close notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
