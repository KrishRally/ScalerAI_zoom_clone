"use client";

import { Mic, Video } from "lucide-react";
import type { DeviceOption } from "@/hooks/useLocalMedia";

interface Props {
  kind: "mic" | "cam";
  devices: DeviceOption[];
  value?: string;
  onChange: (deviceId: string) => void;
}

/** Dropdown to pick a microphone or camera, like the ones under Zoom's preview. */
export default function DeviceSelect({ kind, devices, value, onChange }: Props) {
  const Icon = kind === "mic" ? Mic : Video;
  const label = kind === "mic" ? "Microphone" : "Camera";
  return (
    <label className="relative flex min-w-0 flex-1 items-center">
      <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-zoom-muted" />
      <select
        aria-label={label}
        className="input truncate pl-9"
        value={value ?? ""}
        disabled={devices.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        {devices.length === 0 && <option value="">No {label.toLowerCase()} found</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}
