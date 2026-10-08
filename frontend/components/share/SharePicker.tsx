"use client";

import { useEffect, useRef, useState } from "react";
import { AppWindow, ChevronLeft, Globe, Monitor, X } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { captureScreen, type ShareChoice } from "@/lib/shareScreen";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the captured screen once the browser hands it over. */
  onShare: (stream: MediaStream, withVideo: boolean) => void | Promise<void>;
}

const SOURCES: { surface: ShareChoice["surface"]; label: string; hint: string; icon: typeof Monitor }[] = [
  { surface: "monitor", label: "Screen", hint: "Your entire screen", icon: Monitor },
  { surface: "window", label: "Window", hint: "One app window", icon: AppWindow },
  { surface: "browser", label: "Browser tab", hint: "One tab, with its sound", icon: Globe },
];

/**
 * Zoom's Share Screen window: pick what to share, then how to present it.
 * Browsers don't let a web page list your windows, so after "Share" the
 * browser shows its own list to choose the exact screen, window or tab.
 */
export default function SharePicker({ open, onClose, onShare }: Props) {
  const [step, setStep] = useState<"source" | "present">("source");
  const [choice, setChoice] = useState<ShareChoice>({ surface: "monitor", shareSound: false, optimizeVideo: false, withVideo: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The parent may pass a new onClose on every render; only reset when the window opens.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    setStep("source");
    setError(null);
    setBusy(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const set = (changes: Partial<ShareChoice>) => setChoice((c) => ({ ...c, ...changes }));

  const share = async () => {
    if (busy) return; // a double click must not open two capture prompts
    setBusy(true);
    setError(null);
    try {
      const stream = await captureScreen(choice);
      await onShare(stream, choice.withVideo);
    } catch (e) {
      // Closing the browser's list is not an error: just stay here.
      if (!(e instanceof DOMException && e.name === "NotAllowedError")) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Share screen" className="flex w-full max-w-3xl animate-fade-up flex-col overflow-hidden rounded-2xl bg-white text-zoom-text shadow-pop">
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-zoom-border px-4 py-3">
          {step === "present" && (
            <button onClick={() => setStep("source")} className="absolute left-3 flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zoom-muted hover:bg-zoom-surface" aria-label="Back">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          <div className="flex gap-6 text-[15px] font-semibold">
            <span className={step === "source" ? "border-b-2 border-zoom-blue pb-1 text-zoom-ink" : "pb-1 text-zoom-muted"}>Basic</span>
            <span className={step === "present" ? "border-b-2 border-zoom-blue pb-1 text-zoom-ink" : "pb-1 text-zoom-muted"}>Presentation</span>
          </div>
          <button onClick={onClose} className="absolute right-3 rounded-md p-1.5 text-zoom-muted hover:bg-zoom-surface" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "source" ? (
          <div className="p-5">
            <p className="mb-4 text-sm text-zoom-muted">Select a screen, window or browser tab that you want to share</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SOURCES.map(({ surface, label, hint, icon: Icon }) => {
                const active = choice.surface === surface;
                return (
                  <button
                    key={surface}
                    onClick={() => set({ surface })}
                    onDoubleClick={() => setStep("present")}
                    aria-pressed={active}
                    className={`rounded-xl border-2 p-2 text-left transition-colors ${active ? "border-zoom-blue bg-zoom-blue-light/40" : "border-transparent hover:border-zoom-border"}`}
                  >
                    <span className="flex aspect-video items-center justify-center rounded-lg bg-[#E9EBF0] text-zoom-muted">
                      <Icon className="h-10 w-10" strokeWidth={1.5} />
                    </span>
                    <span className="mt-2 block text-center text-sm font-semibold text-zoom-ink">{label}</span>
                    <span className="block text-center text-xs text-zoom-muted">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <p className="mb-4 text-sm text-zoom-muted">How do you want to present?</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { withVideo: false, label: "Screen only", hint: "Everyone sees your shared screen" },
                { withVideo: true, label: "Screen and my video", hint: "Your video appears next to the screen, like a presenter" },
              ].map((o) => {
                const active = choice.withVideo === o.withVideo;
                return (
                  <button
                    key={o.label}
                    onClick={() => set({ withVideo: o.withVideo })}
                    aria-pressed={active}
                    className={`rounded-xl border-2 p-2 text-left transition-colors ${active ? "border-zoom-blue bg-zoom-blue-light/40" : "border-transparent hover:border-zoom-border"}`}
                  >
                    <span className="relative block aspect-video rounded-lg bg-[#E9EBF0]">
                      <span className="absolute inset-3 rounded bg-white/80" />
                      {o.withVideo && <span className="absolute bottom-4 right-4 h-1/3 w-1/4 rounded bg-zoom-blue/70" />}
                    </span>
                    <span className="mt-2 block text-center text-sm font-semibold text-zoom-ink">{o.label}</span>
                    <span className="block text-center text-xs text-zoom-muted">{o.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="mx-5 mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}

        {/* Footer: options and the Share button, like Zoom */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-zoom-border px-5 py-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={choice.shareSound} onChange={(e) => set({ shareSound: e.target.checked })} />
            Share sound
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={choice.optimizeVideo} onChange={(e) => set({ optimizeVideo: e.target.checked })} />
            Optimize for video clip
          </label>
          {step === "source" ? (
            <button className="btn-primary ml-auto min-w-24" onClick={() => setStep("present")}>Next</button>
          ) : (
            <button className="btn-primary ml-auto min-w-24" onClick={share} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : "Share"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
