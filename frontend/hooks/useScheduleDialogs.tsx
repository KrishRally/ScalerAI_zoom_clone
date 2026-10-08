"use client";

import { useCallback, useState } from "react";
import ScheduleMeetingModal from "@/components/modals/ScheduleMeetingModal";
import MeetingSavedModal from "@/components/modals/MeetingSavedModal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { Meeting } from "@/lib/types";

/**
 * Schedule, edit and delete, shared by the Home and Meetings pages.
 * Render `dialogs` somewhere in the page.
 */
export function useScheduleDialogs(onChanged: () => void) {
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [initialStart, setInitialStart] = useState<Date | null>(null);
  const [saved, setSaved] = useState<Meeting | null>(null);

  /** Open the Schedule form, optionally at a suggested start time. */
  const openSchedule = useCallback((start?: Date) => {
    setEditing(null);
    setInitialStart(start ?? null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((meeting: Meeting) => {
    setEditing(meeting);
    setFormOpen(true);
  }, []);

  const remove = useCallback(
    async (meeting: Meeting) => {
      if (!window.confirm(`Delete "${meeting.title}"? This cannot be undone.`)) return;
      try {
        await api.deleteMeeting(meeting.meeting_code);
        toast("Meeting deleted", "success");
        onChanged();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
    [onChanged, toast],
  );

  const handleSaved = (meeting: Meeting) => {
    setFormOpen(false);
    onChanged();
    if (editing) toast("Meeting updated", "success");
    else setSaved(meeting);
  };

  const dialogs = (
    <>
      <ScheduleMeetingModal
        open={formOpen}
        editing={editing}
        initialStart={initialStart}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
      <MeetingSavedModal meeting={saved} onClose={() => setSaved(null)} />
    </>
  );

  return { openSchedule, openEdit, remove, dialogs };
}
