"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import ZoomLogo from "@/components/ui/ZoomLogo";
import { api } from "@/lib/api";
import { parseMeetingInput } from "@/lib/format";

/** Stand-alone "Join Meeting" page, like zoom.us/join. */
export default function JoinPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseMeetingInput(value);
    if (!parsed) return setError("Please enter a valid Meeting ID or invite link.");
    setChecking(true);
    setError(null);
    try {
      const meeting = await api.lookupMeeting(parsed.code);
      const query = parsed.passcode ? `?pwd=${encodeURIComponent(parsed.passcode)}` : "";
      router.push(`/j/${meeting.meeting_code}${query}`);
    } catch (err) {
      setError((err as Error).message);
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-14 items-center justify-between border-b border-zoom-border px-4 sm:px-6">
        <Link href="/"><ZoomLogo /></Link>
        <Link href="/" className="text-sm font-semibold text-zoom-blue hover:underline">Back to home</Link>
      </header>
      <main className="mx-auto max-w-md px-4 pt-16 sm:pt-24">
        <h1 className="text-center text-3xl font-bold text-zoom-ink">Join Meeting</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="meeting" className="label">Meeting ID or invite link</label>
            <input
              id="meeting"
              className="input py-2.5 text-base"
              placeholder="Enter Meeting ID or invite link"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
          <button type="submit" className="btn-primary w-full py-2.5 text-base" disabled={!value.trim() || checking}>
            {checking ? <Spinner className="h-4 w-4" /> : "Join"}
          </button>
        </form>
      </main>
    </div>
  );
}
