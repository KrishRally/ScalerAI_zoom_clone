"use client";

import { useState } from "react";
import { Mic, Video } from "lucide-react";
import DeviceSelect from "@/components/room/DeviceSelect";
import VideoPreview from "@/components/room/VideoPreview";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import SettingsCard from "./SettingsCard";

/**
 * Pick your default microphone and camera. The choice is saved in this browser
 * (devices belong to a computer, not an account) and used by the preview and the meeting.
 * The camera only turns on when you press "Test".
 */
export default function AudioVideoSection() {
  const [testing, setTesting] = useState(false);
  return (
    <SettingsCard id="audio-video" title="Audio & video" description="Choose the microphone and camera to use on this computer.">
      {testing ? (
        <DeviceTester onStop={() => setTesting(false)} />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-zoom-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-zoom-muted">Your camera stays off until you test it.</p>
          <button className="btn-primary" onClick={() => setTesting(true)}>
            <Video className="h-4 w-4" /> Test camera and microphone
          </button>
        </div>
      )}
    </SettingsCard>
  );
}

function DeviceTester({ onStop }: { onStop: () => void }) {
  const media = useLocalMedia({ audio: true, video: true });
  const hasVideo = media.videoOn && !!media.stream?.getVideoTracks().length;

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-video max-w-xl overflow-hidden rounded-lg bg-room-tile">
        {hasVideo ? (
          <VideoPreview stream={media.stream} />
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-[#B3B3B3]">Starting camera...</p>
        )}
        <span
          className={`absolute bottom-3 left-3 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-xs text-white transition-colors ${
            media.speaking ? "ring-2 ring-zoom-speaking" : ""
          }`}
        >
          <Mic className={`h-3.5 w-3.5 ${media.speaking ? "text-zoom-speaking" : ""}`} />
          {media.speaking ? "We can hear you" : "Say something to test your mic"}
        </span>
      </div>
      <div className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row">
        <DeviceSelect kind="mic" devices={media.mics} value={media.micId} onChange={media.selectMic} />
        <DeviceSelect kind="cam" devices={media.cams} value={media.camId} onChange={media.selectCam} />
      </div>
      {media.error && <p className="text-center text-xs text-zoom-red">{media.error}</p>}
      <div className="flex justify-center">
        <button className="btn-secondary" onClick={onStop}>Stop test</button>
      </div>
    </div>
  );
}
