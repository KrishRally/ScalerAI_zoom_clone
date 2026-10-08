"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { canShareScreen, SHARE_UNSUPPORTED, takePendingShare } from "@/lib/shareScreen";
import type { Participant } from "@/lib/types";

interface Options {
  code: string;
  pid: number;
  me: Participant;
  participants: Participant[];
  /** The host's rules don't allow us to share right now. */
  blocked: boolean;
}

/**
 * Our screen share: start it (from the share window here or on the Home page),
 * stop it, and follow the rules. The host can turn sharing off, and only one
 * person shares at a time, so a new share from someone else ends ours.
 */
export function useScreenShare({ code, pid, me, participants, blocked }: Options) {
  const toast = useToast();
  const [screen, setScreen] = useState<MediaStream | null>(null);
  // Presentation option: show our video next to the shared screen.
  const [shareWithVideo, setShareWithVideo] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const screenRef = useRef<MediaStream | null>(null);
  screenRef.current = screen;
  const shareStartedAt = useRef(0);
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      screenRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopShare = useCallback(() => {
    const wasSharing = !!screenRef.current;
    screenRef.current?.getTracks().forEach((t) => t.stop());
    setScreen(null);
    setShareWithVideo(false);
    // Tell everyone we stopped, so their view goes back to the videos.
    if (wasSharing) api.updateSelf(pid, { is_sharing_screen: false, share_with_video: false }).catch(() => {});
  }, [pid]);

  /** Start sharing a screen picked in the share window. */
  const startShare = useCallback(
    async (s: MediaStream, withVideo: boolean) => {
      try {
        await api.updateSelf(pid, { is_sharing_screen: true, share_with_video: withVideo });
      } catch (e) {
        s.getTracks().forEach((t) => t.stop());
        throw e; // for example the host has just turned sharing off
      }
      if (unmounted.current) {
        s.getTracks().forEach((t) => t.stop()); // we left while this was starting
        return;
      }
      shareStartedAt.current = Date.now();
      screenRef.current?.getTracks().forEach((t) => t.stop()); // replacing an earlier share
      // The browser's own "Stop sharing" button ends the track.
      s.getVideoTracks()[0]?.addEventListener("ended", stopShare);
      setScreen(s);
      setShareWithVideo(withVideo);
    },
    [pid, stopShare],
  );

  /** The toolbar's Share button: stop, or open the share window. */
  const toggleShare = () => {
    if (screen) return stopShare();
    if (blocked) return toast("The host has disabled screen sharing", "info");
    if (!canShareScreen()) return toast(SHARE_UNSUPPORTED, "info");
    setPickerOpen(true);
  };

  // Shared from the Home page: the screen is already picked, start sharing it.
  useEffect(() => {
    const pending = takePendingShare(code);
    if (!pending) return;
    startShare(pending.stream, pending.withVideo).catch((e) => toast((e as Error).message, "info"));
    // Only once, when we enter the meeting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The host turned screen sharing off.
  useEffect(() => {
    if (blocked && screenRef.current) {
      stopShare();
      toast("The host has disabled screen sharing", "info");
    }
  }, [blocked, stopShare, toast]);

  // One person shares at a time: if someone else started sharing, the server
  // turned ours off. (Wait a moment after starting, in case the poll is out of date.)
  useEffect(() => {
    if (!screenRef.current || me.is_sharing_screen || Date.now() - shareStartedAt.current < 4000) return;
    const other = participants.find((p) => p.is_sharing_screen && p.id !== pid);
    screenRef.current.getTracks().forEach((t) => t.stop());
    setScreen(null);
    setShareWithVideo(false);
    if (other) toast(`${other.display_name} started sharing`, "info");
  }, [me, participants, pid, toast]);

  return { screen, shareWithVideo, pickerOpen, setPickerOpen, startShare, stopShare, toggleShare };
}
