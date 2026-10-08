"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import type { LocalMedia } from "@/hooks/useLocalMedia";
import { api } from "@/lib/api";
import type { Participant } from "@/lib/types";

/**
 * Keeps the server in step with our mic and camera, both ways:
 * - when we mute or stop video, tell the server (so everyone's list updates);
 * - when the host mutes us or stops our video, the server disagrees with our
 *   devices, so turn them off here too.
 */
export function useMediaSync(pid: number, media: LocalMedia, me: Participant, patchMe: (changes: Partial<Participant>) => void) {
  const toast = useToast();
  const lastLocalChange = useRef(0);
  const { audioOn, videoOn, toggleAudio, toggleVideo } = media;

  useEffect(() => {
    lastLocalChange.current = Date.now();
    patchMe({ is_muted: !audioOn, is_video_on: videoOn });
    api.updateSelf(pid, { is_muted: !audioOn, is_video_on: videoOn }).catch(() => {});
  }, [audioOn, videoOn, pid, patchMe]);

  // Ignore this for a few seconds after our own change, in case the poll was out of date.
  // `me` is a new object on every poll, so this re-checks every 2 seconds.
  useEffect(() => {
    if (Date.now() - lastLocalChange.current < 4000) return;
    if (me.is_muted && audioOn) {
      toggleAudio(false);
      toast("The host has muted you", "info");
    }
    if (!me.is_video_on && videoOn) {
      toggleVideo(false);
      toast("The host has stopped your video", "info");
    }
  }, [me, audioOn, videoOn, toggleAudio, toggleVideo, toast]);
}
