"use client";

import { useEffect, useRef } from "react";

/**
 * Plays one person's voice. Hidden: their picture is shown by the video tile.
 * Browsers may block sound until the page is clicked; `onBlocked` lets the room
 * show a "Turn on audio" button for that case.
 */
export default function RemoteAudio({ stream, onBlocked }: { stream: MediaStream; onBlocked: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(onBlocked);
  }, [stream, onBlocked]);
  return <audio ref={ref} autoPlay data-remote-audio />;
}

/** After a click, try again to play every remote voice. */
export function resumeRemoteAudio() {
  document.querySelectorAll<HTMLAudioElement>("audio[data-remote-audio]").forEach((el) => el.play().catch(() => {}));
}
