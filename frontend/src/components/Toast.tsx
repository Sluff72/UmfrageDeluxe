"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";

/* ── Types ─────────────────────────────────────────────────────── */

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const AUTO_DISMISS_MS = 4000;
const MAX_TOASTS = 3;

/* ── Context ───────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

/* ── Provider ──────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = nextId.current++;
    setToasts((prev) => {
      const updated = [...prev, { id, message, type }];
      // Keep only the newest MAX_TOASTS
      return updated.slice(-MAX_TOASTS);
    });
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast]
  );
  const error = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast]
  );
  const info = useCallback(
    (message: string) => addToast(message, "info"),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}

      {/* Toast container – fixed bottom-right */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-0 right-0 z-50 flex flex-col items-end gap-2 p-4"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ── Single Toast ──────────────────────────────────────────────── */

const TOAST_STYLES: Record<ToastType, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/80 dark:text-red-300",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/80 dark:text-blue-300",
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✗",
  info: "ℹ",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm transition-all animate-in slide-in-from-right ${TOAST_STYLES[toast.type]}`}
      style={{
        animation: "slideInFromRight 0.2s ease-out",
      }}
    >
      <span className="shrink-0 text-base font-bold">
        {TOAST_ICONS[toast.type]}
      </span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
        aria-label="Schließen"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}
