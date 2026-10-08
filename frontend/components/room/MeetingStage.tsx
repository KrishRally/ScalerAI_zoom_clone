"use client";

import { useEffect, useRef } from "react";
import VideoTile from "./VideoTile";
import VideoPreview from "./VideoPreview";
import { useGalleryLayout } from "@/hooks/useGalleryLayout";
import type { ReactionsByPerson } from "@/hooks/useMeetingRoom";
import type { RemoteMedia } from "@/lib/webrtc";
import type { Participant } from "@/lib/types";

export type ViewMode = "gallery" | "speaker";

interface Props {
  participants: Participant[];
  meId: number;
  myStream: MediaStream | null;
  /** Everyone else's audio, camera and screen, from WebRTC. */
  remote: Record<number, RemoteMedia>;
  /** Who is talking right now. */
  speaking: Set<number>;
  /** The emoji floating over each person right now. */
  reactions: ReactionsByPerson;
  view: ViewMode;
  /** Our own screen share, if we are sharing. */
  screen: MediaStream | null;
}

/** The video area: gallery grid, speaker view, or a shared screen. */
export default function MeetingStage({ participants, meId, myStream, remote, speaking, reactions, view, screen }: Props) {
  const tileProps = (p: Participant) => {
    const media = remote[p.id];
    return {
      participant: p,
      isMe: p.id === meId,
      stream: p.id === meId ? myStream : media?.camera ?? null,
      connecting: p.id !== meId && media?.state !== "connected",
      speaking: speaking.has(p.id),
      reaction: reactions[p.id] ?? null,
    };
  };

  // Whose screen to show: someone else's share comes first, then ours.
  const sharer = participants.find((p) => p.is_sharing_screen && p.id !== meId && remote[p.id]?.screen);
  const shared = sharer ? remote[sharer.id]!.screen : screen;

  // Speaker view features whoever spoke last (not us, unless we're alone).
  const lastSpeaker = useLastSpeaker(speaking, meId);

  if (shared || view === "speaker") {
    const others = participants.filter((p) => p.id !== meId);
    const featured = shared
      ? null
      : others.find((p) => p.id === lastSpeaker) ?? others.find((p) => p.role === "host") ?? others[0] ?? participants.find((p) => p.id === meId);
    const strip = shared ? participants : participants.filter((p) => p.id !== featured?.id);

    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2">
        {strip.length > 0 && (
          <div className="scroll-thin flex shrink-0 justify-center gap-2 overflow-x-auto">
            {strip.map((p) => (
              <VideoTile key={p.id} {...tileProps(p)} compact className="h-[72px] w-32 shrink-0 sm:h-[90px] sm:w-40" />
            ))}
          </div>
        )}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {shared ? (
            <div className="relative h-full w-full overflow-hidden rounded-lg bg-black">
              <VideoPreview stream={shared} mirrored={false} className="!object-contain" />
              {sharer && (
                <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                  You are viewing {sharer.display_name}&apos;s screen
                </span>
              )}
            </div>
          ) : (
            featured && <VideoTile {...tileProps(featured)} className="aspect-video max-h-full w-full max-w-full" />
          )}
        </div>
      </div>
    );
  }

  return <Gallery participants={participants} tileProps={tileProps} />;
}

/** The last person (other than us) who was heard talking. */
function useLastSpeaker(speaking: Set<number>, meId: number): number | null {
  const last = useRef<number | null>(null);
  useEffect(() => {
    const other = Array.from(speaking).find((id) => id !== meId);
    if (other !== undefined) last.current = other;
  }, [speaking, meId]);
  const now = Array.from(speaking).find((id) => id !== meId);
  return now ?? last.current;
}

function Gallery({
  participants,
  tileProps,
}: {
  participants: Participant[];
  tileProps: (p: Participant) => React.ComponentProps<typeof VideoTile>;
}) {
  const { ref, tileWidth, tileHeight, gap } = useGalleryLayout(participants.length);
  return (
    <div ref={ref} className="h-full w-full p-2">
      <div className="flex h-full flex-wrap content-center items-center justify-center" style={{ gap }}>
        {tileWidth > 0 &&
          participants.map((p) => (
            <VideoTile key={p.id} {...tileProps(p)} width={tileWidth} height={tileHeight} compact={tileWidth < 260} />
          ))}
      </div>
    </div>
  );
}
