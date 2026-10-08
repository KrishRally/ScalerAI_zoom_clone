"use client";

import { useEffect, useRef, useState } from "react";

const ASPECT = 16 / 9;
const GAP = 8;

/**
 * Works out the biggest 16:9 tile size that fits `count` tiles in the container,
 * by trying every possible number of columns. Same idea as Zoom's gallery view.
 */
export function useGalleryLayout(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!box.w || !box.h || count === 0) return;
    let best = { width: 0, height: 0 };
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      let width = (box.w - GAP * (cols - 1)) / cols;
      let height = width / ASPECT;
      const maxHeight = (box.h - GAP * (rows - 1)) / rows;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * ASPECT;
      }
      if (width > best.width) best = { width, height };
    }
    setSize({ width: Math.floor(best.width), height: Math.floor(best.height) });
  }, [box, count]);

  return { ref, tileWidth: size.width, tileHeight: size.height, gap: GAP };
}
