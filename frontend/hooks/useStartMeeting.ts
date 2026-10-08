"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveMeetingSession, saveParticipantToken } from "@/lib/session";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import type { JoinResult } from "@/lib/types";

/** Remember who we are in this tab, so the meeting room can act as us. */
export function rememberJoin(meetingCode: string, me: JoinResult) {
  saveParticipantToken(me.id, me.participant_token);
  saveMeetingSession(meetingCode, {
    participantId: me.id,
    startMuted: me.is_muted,
    startVideoOn: me.is_video_on,
  });
}

/**
 * Starting a meeting as the host.
 *
 * Normally this opens the preview window first (/j/<id>?start=1). If the user
 * turned off "Always show the preview" in Settings, we join straight away.
 * The server makes us host because our sign in proves we own the meeting.
 */
export function useStartMeeting() {
  const router = useRouter();
  const { user, settings } = useAuth();
  const toast = useToast();
  const [starting, setStarting] = useState(false);

  const startExisting = useCallback(
    async (meetingCode: string, opts: { videoOn?: boolean } = {}) => {
      const videoOn = opts.videoOn ?? settings?.start_with_video ?? true;
      if (settings?.show_preview ?? true) {
        router.push(`/j/${meetingCode}?start=1${videoOn ? "" : "&video=off"}`);
        return;
      }
      if (!user) {
        toast("Still loading your account, please try again", "error");
        return;
      }
      setStarting(true);
      try {
        const me = await api.joinMeeting(meetingCode, {
          display_name: user.name,
          is_video_on: videoOn,
          is_muted: settings?.join_muted ?? false,
        });
        rememberJoin(meetingCode, me);
        router.push(`/meeting/${meetingCode}`);
      } catch (e) {
        toast((e as Error).message, "error");
        setStarting(false);
      }
    },
    [user, settings, router, toast],
  );

  const startInstant = useCallback(
    async (opts: { videoOn?: boolean } = {}) => {
      setStarting(true);
      try {
        const meeting = await api.createInstantMeeting();
        await startExisting(meeting.meeting_code, opts);
      } catch (e) {
        toast((e as Error).message, "error");
        setStarting(false);
      }
    },
    [startExisting, toast],
  );

  return { startInstant, startExisting, starting };
}
