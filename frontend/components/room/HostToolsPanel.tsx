"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import PanelShell from "./PanelShell";
import type { MeetingSettings } from "@/lib/types";

interface Props {
  settings: MeetingSettings;
  onChange: (changes: Partial<MeetingSettings>) => Promise<void>;
  onSuspend: () => Promise<void>;
  onClose: () => void;
}

type Key = keyof MeetingSettings;

const MEETING_SWITCHES: { key: Key; label: string; hint: string }[] = [
  { key: "waiting_room", label: "Enable waiting room", hint: "New people wait until you let them in" },
  { key: "is_locked", label: "Lock meeting", hint: "No one new can join" },
  { key: "mute_on_entry", label: "Mute participants upon entry", hint: "People join with their mic off" },
];

const ALLOW_SWITCHES: { key: Key; label: string }[] = [
  { key: "allow_chat", label: "Chat" },
  { key: "allow_rename", label: "Rename themselves" },
  { key: "allow_unmute", label: "Unmute themselves" },
  { key: "allow_video", label: "Start video" },
  { key: "allow_screen_share", label: "Share screen" },
  { key: "allow_reactions", label: "Send reactions" },
];

/** Zoom's "Host tools" panel. Only the host sees it. */
export default function HostToolsPanel({ settings, onChange, onSuspend, onClose }: Props) {
  const [busy, setBusy] = useState<Key | "suspend" | null>(null);

  const toggle = async (key: Key) => {
    setBusy(key);
    try {
      await onChange({ [key]: !settings[key] });
    } finally {
      setBusy(null);
    }
  };

  const suspend = async () => {
    if (!window.confirm("Suspend participant activities? Everyone's audio, video and chat will stop and the meeting will be locked.")) return;
    setBusy("suspend");
    try {
      await onSuspend();
    } finally {
      setBusy(null);
    }
  };

  return (
    <PanelShell title="Host tools" onClose={onClose}>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm">
        <div className="space-y-1">
          {MEETING_SWITCHES.map(({ key, label, hint }) => (
            <Row key={key} label={label} hint={hint} on={settings[key]} busy={busy === key} onToggle={() => toggle(key)} />
          ))}
        </div>

        <p className="mt-5 px-1 text-xs font-bold uppercase tracking-wide text-zoom-muted">Allow all participants to:</p>
        <div className="mt-1 space-y-1">
          {ALLOW_SWITCHES.map(({ key, label }) => (
            <Row key={key} label={label} on={settings[key]} busy={busy === key} onToggle={() => toggle(key)} />
          ))}
        </div>
      </div>

      <div className="border-t border-zoom-border p-3">
        <button
          onClick={suspend}
          disabled={busy === "suspend"}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zoom-red/30 py-2 text-sm font-semibold text-zoom-red hover:bg-red-50 disabled:opacity-60"
        >
          <ShieldAlert className="h-4 w-4" /> Suspend participant activities
        </button>
      </div>
    </PanelShell>
  );
}

function Row({
  label,
  hint,
  on,
  busy,
  onToggle,
}: {
  label: string;
  hint?: string;
  on: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 hover:bg-zoom-surface">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-xs text-zoom-muted">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={busy}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-zoom-blue" : "bg-[#C9CCD1]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
