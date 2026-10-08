"use client";

import { useEffect, useRef } from "react";

interface Props {
  stream: MediaStream | null;
  mirrored?: boolean;
  className?: string;
}

/** A <video> element that plays a MediaStream. */
export default function VideoPreview({ stream, mirrored = true, className = "" }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted // never play your own audio back to yourself
      className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""} ${className}`}
    />
  );
}
