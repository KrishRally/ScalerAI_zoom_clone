"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import type { Meeting } from "@/lib/types";
import { useCurrentUser } from "@/components/providers/UserProvider";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (meeting: Meeting) => void;
  /** Pass a meeting to edit it instead of creating a new one. */
  editing?: Meeting | null;
}

// Zoom offers start times in 30 minute steps.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? 30 : 0;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const label = new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return { value, label };
});

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The next half hour from now, which is Zoom's default start time. */
function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

const timeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Local time";

export default function ScheduleMeetingModal({ open, onClose, onSaved, editing }: Props) {
  const { user } = useCurrentUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [autoPasscode, setAutoPasscode] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [muteOnEntry, setMuteOnEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fill the form each time it opens.
  useEffect(() => {
    if (!open) return;
    const start = editing?.scheduled_start ? new Date(editing.scheduled_start) : nextHalfHour();
    const duration = editing?.duration_minutes ?? 60;
    setTitle(editing?.title ?? (user ? `${user.name}'s Zoom Meeting` : "My Meeting"));
    setDescription(editing?.description ?? "");
    setDate(toDateInput(start));
    setTime(toTimeInput(start));
    setHours(Math.floor(duration / 60));
    setMinutes(duration % 60);
    setAutoPasscode(true);
    setPasscode("");
    setWaitingRoom(editing?.settings.waiting_room ?? false);
    setMuteOnEntry(editing?.settings.mute_on_entry ?? false);
    setError(null);
  }, [open, editing, user]);

  // Make sure an edited meeting's odd time (e.g. 10:15) is still selectable.
  const timeOptions = useMemo(() => {
    if (!time || TIME_OPTIONS.some((t) => t.value === time)) return TIME_OPTIONS;
    const [h, m] = time.split(":").map(Number);
    const label = new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return [...TIME_OPTIONS, { value: time, label }].sort((a, b) => a.value.localeCompare(b.value));
  }, [time]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // The date and time inputs are in the user's local time; convert to an exact moment.
    const start = new Date(`${date}T${time}:00`);
    const duration = hours * 60 + minutes;
    if (!title.trim()) return setError("Please enter a topic.");
    if (Number.isNaN(start.getTime())) return setError("Please pick a valid date and time.");
    if (start.getTime() < Date.now() - 5 * 60_000) return setError("Please choose a time in the future.");
    if (duration < 15) return setError("Duration must be at least 15 minutes.");
    if (!autoPasscode && !/^[A-Za-z0-9]{1,10}$/.test(passcode))
      return setError("Passcode must be 1 to 10 letters or numbers.");

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_start: start.toISOString(),
        duration_minutes: duration,
        waiting_room: waitingRoom,
        mute_on_entry: muteOnEntry,
      };
      const saved = editing
        ? await api.updateMeeting(editing.meeting_code, payload)
        : await api.scheduleMeeting({ ...payload, passcode: autoPasscode ? undefined : passcode });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit meeting" : "Schedule meeting"} width="max-w-lg">
      <form id="schedule-form" onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label" htmlFor="topic">Topic</label>
          <input id="topic" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="label" htmlFor="description">Description (optional)</label>
          <textarea
            id="description"
            className="input min-h-[72px] resize-y"
            value={description}
            maxLength={2000}
            placeholder="Add a description"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <span className="label">When</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoom-muted" />
              <input
                type="date"
                aria-label="Date"
                className="input pl-9"
                value={date}
                min={toDateInput(new Date())}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <select aria-label="Time" className="input sm:w-40" value={time} onChange={(e) => setTime(e.target.value)}>
              {timeOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label">Duration</span>
          <div className="flex items-center gap-2 text-sm">
            <select aria-label="Hours" className="input w-20" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {Array.from({ length: 25 }, (_, h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <span>hr</span>
            <select aria-label="Minutes" className="input w-20" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span>min</span>
          </div>
        </div>

        <div className="text-sm">
          <span className="label">Time zone</span>
          <p className="text-zoom-muted">{timeZone}</p>
        </div>

        <div className="text-sm">
          <span className="label">Meeting ID</span>
          <label className="flex items-center gap-2">
            <input type="radio" checked readOnly className="accent-zoom-blue" />
            Generate automatically
          </label>
        </div>

        {!editing && (
          <div className="text-sm">
            <span className="label">Security</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-zoom-blue"
                checked={!autoPasscode}
                onChange={(e) => setAutoPasscode(!e.target.checked)}
              />
              Set my own passcode
            </label>
            {autoPasscode ? (
              <p className="mt-1 text-xs text-zoom-muted">A passcode will be generated. Only people with the invite link or passcode can join.</p>
            ) : (
              <input
                className="input mt-2 w-48"
                value={passcode}
                maxLength={10}
                placeholder="Passcode"
                onChange={(e) => setPasscode(e.target.value)}
                aria-label="Passcode"
              />
            )}
          </div>
        )}

        <div className="text-sm">
          <span className="label">Options</span>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={waitingRoom} onChange={(e) => setWaitingRoom(e.target.checked)} />
              Enable waiting room
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-zoom-blue" checked={muteOnEntry} onChange={(e) => setMuteOnEntry(e.target.checked)} />
              Mute participants upon entry
            </label>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary min-w-20" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
