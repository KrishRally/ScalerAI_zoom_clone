"use client";

import { Hand, MicOff } from "lucide-react";
import VideoPreview from "./VideoPreview";
import type { Participant } from "@/lib/types";

interface Props {
  participant: Participant;
  isMe: boolean;
  /** Our camera, or theirs arriving over WebRTC. */
  stream?: MediaStream | null;
  /** Still setting up the connection to this person. */
  connecting?: boolean;
  speaking?: boolean;
  /** A floating emoji. The id changes for every new reaction so the animation restarts. */
  reaction?: { emoji: string; id: number } | null;
  width?: number;
  height?: number;
  compact?: boolean;
  className?: string;
}

/** One person in the gallery: their video, or their name when the camera is off. */
export default function VideoTile({
  participant,
  isMe,
  stream,
  speaking,
  connecting,
  reaction,
  width,
  height,
  compact,
  className = "",
}: Props) {
  const hasVideo = participant.is_video_on && !!stream?.getVideoTracks().length;

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-room-tile ${className}`}
      style={width ? { width, height } : undefined}
    >
      {hasVideo ? (
        // Only our own picture is mirrored, like a mirror. Others see you the right way round.
        <VideoPreview stream={stream!} mirrored={isMe} />
      ) : (
        // Zoom shows the person's name in large text when their video is off.
        <div className="flex h-full w-full items-center justify-center px-3">
          <span
            className={`truncate text-center font-semibold text-white ${
              compact ? "text-sm" : "text-xl sm:text-3xl"
            }`}
          >
            {participant.display_name}
          </span>
        </div>
      )}

      {connecting && (
        <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-[#D0D0D0]">Connecting...</span>
      )}

      {/* Green border while talking */}
      {speaking && <div className="pointer-events-none absolute inset-0 rounded-lg border-[3px] border-zoom-speaking" />}

      {participant.is_hand_raised && (
        <span className="absolute left-2 top-2 rounded-md bg-amber-400 p-1 text-zoom-ink" title="Hand raised">
          <Hand className={compact ? "h-3 w-3" : "h-4 w-4"} />
        </span>
      )}

      {reaction && (
        <span key={reaction.id} className="absolute bottom-10 left-3 animate-float-up text-4xl">
          {reaction.emoji}
        </span>
      )}

      <div className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-12px)] items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-white">
        {participant.is_muted && <MicOff className="h-3 w-3 shrink-0 text-zoom-red" />}
        <span className={`truncate ${compact ? "text-[10px]" : "text-xs"}`}>{participant.display_name}</span>
      </div>
    </div>
  );
}
