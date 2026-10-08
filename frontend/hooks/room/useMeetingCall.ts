"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePeerMesh } from "@/hooks/usePeerMesh";
import { useSpeaking } from "@/hooks/useSpeaking";
import type { Participant } from "@/lib/types";

// Someone we still can't reach after this long gets a message in the room.
const STUCK_AFTER_MS = 25_000;

/**
 * The call itself: audio and video with everyone else over WebRTC, who is
 * talking right now, and two problems worth telling the user about (someone
 * can't be reached, or the browser blocked sound until a click).
 */
export function useMeetingCall(
  pid: number,
  others: Participant[],
  localStream: MediaStream | null,
  screen: MediaStream | null,
  localSpeaking: boolean,
) {
  const remote = usePeerMesh(pid, others.map((p) => p.id), localStream, screen);

  // Video calls need everyone on the same Wi-Fi network; say so if someone stays unreachable.
  const [stuck, setStuck] = useState(false);
  const states = others.map((p) => `${p.id}:${remote[p.id]?.state}`).join(",");
  useEffect(() => {
    const notConnected = others.some((p) => remote[p.id] && remote[p.id].state !== "connected");
    if (!notConnected) return setStuck(false);
    const t = setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => clearTimeout(t);
    // `states` sums up exactly what this depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states]);

  // Who is talking: other people's voices (not when muted), plus our own mic.
  const voices = useMemo(
    () => Object.fromEntries(others.filter((p) => !p.is_muted).map((p) => [p.id, remote[p.id]?.audio])),
    [others, remote],
  );
  const remoteSpeaking = useSpeaking(voices);
  const speaking = useMemo(() => {
    const all = new Set(remoteSpeaking);
    if (localSpeaking) all.add(pid);
    return all;
  }, [remoteSpeaking, localSpeaking, pid]);

  // Browsers may block sound until the page is clicked.
  const [audioBlocked, setAudioBlocked] = useState(false);
  const onAudioBlocked = useCallback(() => setAudioBlocked(true), []);

  return { remote, speaking, stuck, audioBlocked, onAudioBlocked, clearAudioBlocked: () => setAudioBlocked(false) };
}
