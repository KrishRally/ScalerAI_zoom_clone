"use client";

import Switch from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import type { UserSettings } from "@/lib/types";
import SettingsCard from "./SettingsCard";

const OPTIONS: { key: keyof UserSettings; label: string; hint: string }[] = [
  { key: "start_with_video", label: "Start meetings with video on", hint: "Your camera is on when you start or join a meeting." },
  { key: "join_muted", label: "Mute my microphone when joining", hint: "You join with your mic off." },
  { key: "show_preview", label: "Always show the preview window", hint: "Check your camera and mic before every meeting." },
  { key: "default_waiting_room", label: "Waiting room for new meetings", hint: "People wait until you let them in." },
  { key: "default_mute_on_entry", label: "Mute participants upon entry", hint: "Used for new meetings you create." },
];

/** Personal defaults. Saved right away when a switch is flipped. */
export default function MeetingDefaultsSection() {
  const { settings, updateSettings } = useAuth();
  const toast = useToast();
  if (!settings) return null;

  const toggle = async (key: keyof UserSettings) => {
    try {
      await updateSettings({ [key]: !settings[key] });
      toast("Settings saved", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <SettingsCard id="meetings" title="Meetings" description="Defaults for meetings you start, join or schedule.">
      <ul className="divide-y divide-zoom-border">
        {OPTIONS.map(({ key, label, hint }) => (
          <li key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zoom-ink">{label}</p>
              <p className="text-xs text-zoom-muted">{hint}</p>
            </div>
            <Switch on={settings[key]} label={label} onToggle={() => toggle(key)} />
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
