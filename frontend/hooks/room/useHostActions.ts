"use client";

import { useToast } from "@/components/ui/Toast";
import type { MeetingRoom } from "@/hooks/useMeetingRoom";
import { api } from "@/lib/api";
import type { MeetingSettings, Participant } from "@/lib/types";

/**
 * Everything the host can do to other people and to the meeting. The server
 * checks every one of these again (only the host may), so this is just the
 * clicks, confirmations and messages.
 */
export function useHostActions(code: string, pid: number, room: MeetingRoom, onEnded: () => void) {
  const toast = useToast();
  const fail = (e: unknown) => toast((e as Error).message, "error");

  /** Run a host action, show an optional message, and refresh the room straight away. */
  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action();
      if (success) toast(success, "success");
      room.refresh();
    } catch (e) {
      fail(e);
    }
  };

  return {
    muteAll: () =>
      run(async () => {
        const { muted } = await api.muteAll(code, pid);
        toast(muted ? `Muted ${muted} participant${muted > 1 ? "s" : ""}` : "Everyone is already muted", "success");
      }),

    mute: (p: Participant) => run(() => api.muteParticipant(p.id, pid)),

    remove: (p: Participant) => {
      if (!window.confirm(`Remove ${p.display_name} from the meeting?`)) return;
      run(() => api.removeParticipant(p.id, pid), `${p.display_name} was removed`);
    },

    makeHost: (p: Participant) => {
      if (!window.confirm(`Make ${p.display_name} the host? You will lose host controls.`)) return;
      run(() => api.makeHost(p.id, pid), `${p.display_name} is now the host`);
    },

    admit: (p: Participant) => run(() => api.admit(p.id, pid), `${p.display_name} was admitted`),

    admitAll: () => run(() => api.admitAll(code, pid), "Everyone in the waiting room was admitted"),

    changeSettings: async (changes: Partial<MeetingSettings>) => {
      try {
        room.patchSettings(await api.updateSettings(code, pid, changes));
      } catch (e) {
        fail(e);
      }
    },

    suspend: async () => {
      try {
        room.patchSettings(await api.suspend(code, pid));
        toast("Participant activities suspended. The meeting is locked.", "success");
        room.refresh();
      } catch (e) {
        fail(e);
      }
    },

    endForAll: async () => {
      try {
        await api.endMeeting(code, pid);
        onEnded();
        toast("Meeting ended for all participants", "success");
      } catch (e) {
        fail(e);
      }
    },
  };
}
