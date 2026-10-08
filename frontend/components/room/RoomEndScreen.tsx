import Link from "next/link";
import ZoomLogo from "@/components/ui/ZoomLogo";
import type { RoomEnd } from "@/hooks/useMeetingRoom";

const MESSAGES: Record<RoomEnd, { title: string; body: string }> = {
  ended: { title: "This meeting has been ended by host", body: "Thank you for attending." },
  removed: { title: "You have been removed from this meeting", body: "The host removed you from the meeting, so you can't rejoin it." },
  left: { title: "You left the meeting", body: "You were disconnected because the connection was lost." },
  missing: { title: "This meeting is no longer available", body: "The meeting may have been deleted by the host." },
};

/** What you see when the meeting is over for you. */
export default function RoomEndScreen({ reason, code }: { reason: RoomEnd; code: string }) {
  const { title, body } = MESSAGES[reason];
  return (
    <div className="flex min-h-screen flex-col bg-zoom-surface">
      <header className="flex h-14 items-center border-b border-zoom-border bg-white px-4 sm:px-6">
        <Link href="/"><ZoomLogo /></Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-zoom-border bg-white p-8 text-center shadow-card">
          <h1 className="text-xl font-bold text-zoom-ink">{title}</h1>
          <p className="mt-2 text-sm text-zoom-muted">{body}</p>
          <div className="mt-6 flex justify-center gap-2">
            {reason === "left" && (
              <Link href={`/j/${code}`} className="btn-secondary">Rejoin</Link>
            )}
            <Link href="/" className="btn-primary">Back to home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
