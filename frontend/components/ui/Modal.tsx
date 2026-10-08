"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export default function Modal({ open, title, onClose, children, footer, width = "max-w-md" }: Props) {
  // Close on Escape, like a native dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full ${width} animate-fade-up flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-xl`}
      >
        <div className="flex items-center justify-between border-b border-zoom-border px-5 py-3.5">
          <h2 className="text-base font-bold text-zoom-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-zoom-border px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
