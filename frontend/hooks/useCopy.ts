"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

/** Copy text to the clipboard and show a toast. */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async (text: string, what = "Text") => {
      try {
        await navigator.clipboard.writeText(text);
        toast(`${what} copied to clipboard`, "success");
      } catch {
        toast("Could not copy. Please copy it manually.", "error");
      }
    },
    [toast],
  );
}
