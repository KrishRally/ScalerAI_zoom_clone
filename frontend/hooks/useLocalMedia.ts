"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  audio: boolean;
  video: boolean;
}

/**
 * Your own camera and microphone.
 *
 * - Muting just disables the audio track (instant, no new permission prompt).
 * - Turning video off fully stops the camera so its light goes off, like Zoom.
 *   Turning it back on asks the browser for a fresh video track.
 * - `speaking` is true while your mic picks up sound, used for the green border.
 */
export function useLocalMedia(initial: Options) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioOn, setAudioOn] = useState(initial.audio);
  const [videoOn, setVideoOn] = useState(initial.video);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const updateStream = (next: MediaStream | null) => {
    streamRef.current = next;
    setStream(next);
  };

  // Ask for camera and mic once. If one is blocked, try to get at least the other.
  useEffect(() => {
    let cancelled = false;
    const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    if (!supported) {
      setError("Your browser does not support camera access here (it needs HTTPS).");
      return;
    }

    async function acquire() {
      const tries: MediaStreamConstraints[] = [
        { audio: true, video: initial.video },
        { audio: true, video: false },
        { audio: false, video: initial.video },
      ];
      for (const constraints of tries) {
        if (!constraints.audio && !constraints.video) continue;
        try {
          const s = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          s.getAudioTracks().forEach((t) => (t.enabled = initial.audio));
          updateStream(s);
          if (!s.getVideoTracks().length) setVideoOn(false);
          if (!s.getAudioTracks().length) setError("Microphone not available");
          return;
        } catch {
          // try the next combination
        }
      }
      if (!cancelled) {
        setError("Camera and microphone are blocked. You can still join and chat.");
        setVideoOn(false);
        setAudioOn(false);
      }
    }
    acquire();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // Only on first mount; later changes go through the toggle functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAudio = useCallback((on?: boolean) => {
    setAudioOn((prev) => {
      const next = on ?? !prev;
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  const toggleVideo = useCallback(async (on?: boolean) => {
    const current = streamRef.current;
    const hasVideo = !!current?.getVideoTracks().length;
    const next = on ?? !hasVideo;

    if (!next) {
      current?.getVideoTracks().forEach((t) => {
        t.stop();
        current.removeTrack(t);
      });
      updateStream(current ? new MediaStream(current.getTracks()) : null);
      setVideoOn(false);
      return true;
    }

    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
      const merged = new MediaStream([...(current?.getAudioTracks() ?? []), ...cam.getVideoTracks()]);
      updateStream(merged);
      setVideoOn(true);
      return true;
    } catch {
      setError("Could not start your camera. Check the browser permission.");
      return false;
    }
  }, []);

  // Simple voice activity detection with the Web Audio API.
  const audioTrack = stream?.getAudioTracks()[0];
  useEffect(() => {
    if (!audioTrack || !audioOn) {
      setSpeaking(false);
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let quietFrames = 0;
    const id = setInterval(() => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      if (avg > 18) {
        quietFrames = 0;
        setSpeaking(true);
      } else if (++quietFrames > 4) {
        setSpeaking(false);
      }
    }, 150);
    return () => {
      clearInterval(id);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [audioTrack, audioOn]);

  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    updateStream(null);
  }, []);

  return { stream, audioOn, videoOn, error, speaking, toggleAudio, toggleVideo, stopAll };
}
