"use client";

import { useEffect, useState } from "react";

const LOUD = 18; // average volume (0-255) that counts as talking
const QUIET_TICKS = 4; // stay "speaking" through short pauses

/**
 * Who is talking right now, from their audio streams (ours and other people's).
 * Uses one Web Audio context with a volume meter per stream.
 */
export function useSpeaking(streams: Record<number, MediaStream | null | undefined>): Set<number> {
  const [speaking, setSpeaking] = useState<Set<number>>(new Set());

  // Only rebuild the meters when the actual audio tracks change.
  const entries = Object.entries(streams).filter(([, s]) => s?.getAudioTracks().length) as [string, MediaStream][];
  const key = entries.map(([id, s]) => `${id}:${s.getAudioTracks()[0].id}`).join("|");

  useEffect(() => {
    if (!entries.length) {
      setSpeaking(new Set());
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const meters = entries.map(([id, stream]) => {
      const source = ctx.createMediaStreamSource(new MediaStream([stream.getAudioTracks()[0]]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      return { id: Number(id), source, analyser, data: new Uint8Array(analyser.frequencyBinCount), quiet: QUIET_TICKS };
    });
    const timer = setInterval(() => {
      const now = new Set<number>();
      for (const m of meters) {
        m.analyser.getByteFrequencyData(m.data);
        const avg = m.data.reduce((a, b) => a + b, 0) / m.data.length;
        m.quiet = avg > LOUD ? 0 : m.quiet + 1;
        if (m.quiet <= QUIET_TICKS) now.add(m.id);
      }
      setSpeaking((prev) => (prev.size === now.size && Array.from(now).every((id) => prev.has(id)) ? prev : now));
    }, 150);
    return () => {
      clearInterval(timer);
      meters.forEach((m) => m.source.disconnect());
      ctx.close().catch(() => {});
    };
    // `key` stands in for `entries`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return speaking;
}
