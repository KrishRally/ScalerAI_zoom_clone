"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

/** Call toast("Copied!") from any component inside the provider. */
export const useToast = () => useContext(ToastContext);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setToasts((list) => [...list, { id, kind, message }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-md animate-fade-up items-center gap-2 rounded-lg bg-zoom-ink px-4 py-2.5 text-sm text-white shadow-pop"
          >
            {t.kind === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-zoom-green" />}
            {t.kind === "error" && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
            {t.kind === "info" && <Info className="h-4 w-4 shrink-0 text-blue-300" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
