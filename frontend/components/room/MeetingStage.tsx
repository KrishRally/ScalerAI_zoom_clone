"use client";

import VideoTile from "./VideoTile";
import VideoPreview from "./VideoPreview";
import { useGalleryLayout } from "@/hooks/useGalleryLayout";
import type { Participant } from "@/lib/types";

export type ViewMode = "gallery" | "speaker";

interface Props {
  participants: Participant[];
  meId: number;
  myStream: MediaStream | null;
  speaking: boolean;
  reaction: { emoji: string; id: number } | null;
  view: ViewMode;
  screen: MediaStream | null;
}

/** The video area: gallery grid, speaker view, or your shared screen. */
export default function MeetingStage({ participants, meId, myStream, speaking, reaction, view, screen }: Props) {
  const tileProps = (p: Participant) => ({
    participant: p,
    isMe: p.id === meId,
    stream: p.id === meId ? myStream : null,
    speaking: p.id === meId && speaking,
    reaction: p.id === meId ? reaction : null,
  });

  // Screen share and speaker view both use one big area with a strip of small tiles.
  if (screen || view === "speaker") {
    const others = participants.filter((p) => p.id !== meId);
    // Without remote audio we can't detect who is talking, so we feature the host,
    // or the first other person, and fall back to you when you're alone.
    const featured = screen ? null : others.find((p) => p.role === "host") ?? others[0] ?? participants.find((p) => p.id === meId);
    const strip = screen ? participants : participants.filter((p) => p.id !== featured?.id);

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
          {screen ? (
            <div className="relative h-full w-full overflow-hidden rounded-lg bg-black">
              <VideoPreview stream={screen} mirrored={false} className="!object-contain" />
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
