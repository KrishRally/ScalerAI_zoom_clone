"use client";

import { Volume2, WifiOff } from "lucide-react";

interface Props {
  sharing: boolean;
  onStopShare: () => void;
  connectionLost: boolean;
  /** Someone's audio and video can't be reached. */
  callStuck: boolean;
  audioBlocked: boolean;
  onResumeAudio: () => void;
  mediaError: string | null;
}

/** The thin bars under the top bar that tell you what's going on. */
export default function RoomBanners({ sharing, onStopShare, connectionLost, callStuck, audioBlocked, onResumeAudio, mediaError }: Props) {
  return (
    <>
      {sharing && (
        <div className="flex shrink-0 items-center justify-center gap-3 bg-zoom-green/90 py-1 text-xs font-semibold text-white">
          You are screen sharing
          <button onClick={onStopShare} className="rounded bg-zoom-red px-2 py-0.5 hover:bg-zoom-red-hover">Stop Share</button>
        </div>
      )}
      {connectionLost && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-500 py-1 text-xs font-semibold text-zoom-ink">
          <WifiOff className="h-3.5 w-3.5" /> Connection lost. Reconnecting...
        </div>
      )}
      {callStuck && (
        <div className="shrink-0 bg-[#2B2B2B] px-3 py-1 text-center text-xs text-[#D0D0D0]">
          Can&apos;t reach someone&apos;s audio and video. Video calls work when everyone is on the same Wi-Fi network. Chat and reactions still work.
        </div>
      )}
      {audioBlocked && (
        <button onClick={onResumeAudio} className="flex shrink-0 items-center justify-center gap-2 bg-zoom-blue py-1.5 text-xs font-semibold text-white hover:bg-zoom-blue-hover">
          <Volume2 className="h-4 w-4" /> Click to hear the other participants
        </button>
      )}
      {mediaError && !connectionLost && <div className="shrink-0 bg-[#2B2B2B] py-1 text-center text-xs text-[#D0D0D0]">{mediaError}</div>}
    </>
  );
}
