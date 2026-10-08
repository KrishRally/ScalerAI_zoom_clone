"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { loadShowPreview, saveMeetingSession } from "@/lib/session";
import { useCurrentUser } from "@/components/providers/UserProvider";
import { useToast } from "@/components/ui/Toast";

/**
 * Starting a meeting as the host.
 *
 * Normally this opens the preview window first (/j/<id>?start=1). If the user
 * unticked "Always show this preview", we join straight away with our user id
 * (so the server makes us host), remember who we are in this tab, and open the room.
 */
export function useStartMeeting() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const toast = useToast();
  const [starting, setStarting] = useState(false);

  const startExisting = useCallback(
    async (meetingCode: string, opts: { videoOn?: boolean } = {}) => {
      if (!user) {
        toast("Still loading your account, please try again", "error");
        return;
      }
      const videoOn = opts.videoOn ?? true;
      if (loadShowPreview()) {
        router.push(`/j/${meetingCode}?start=1${videoOn ? "" : "&video=off"}`);
        return;
      }
      setStarting(true);
      try {
        const me = await api.joinMeeting(meetingCode, {
          display_name: user.name,
          user_id: user.id,
          is_video_on: videoOn,
          is_muted: false,
        });
        saveMeetingSession(meetingCode, {
          participantId: me.id,
          startMuted: me.is_muted,
          startVideoOn: me.is_video_on,
        });
        router.push(`/meeting/${meetingCode}`);
      } catch (e) {
        toast((e as Error).message, "error");
        setStarting(false);
      }
    },
    [user, router, toast],
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
