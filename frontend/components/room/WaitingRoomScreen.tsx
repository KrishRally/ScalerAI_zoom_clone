import { Clock } from "lucide-react";
import ZoomLogo from "@/components/ui/ZoomLogo";
import Spinner from "@/components/ui/Spinner";
import { formatMeetingCode } from "@/lib/format";
import type { Meeting } from "@/lib/types";

/** What a guest sees while they wait for the host to let them in. */
export default function WaitingRoomScreen({ meeting, onLeave }: { meeting: Meeting; onLeave: () => void }) {
  const hostIsHere = meeting.status === "live";
  return (
    <div className="flex min-h-screen flex-col bg-room-bg text-white">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <span className="rounded-md bg-white px-2 py-1"><ZoomLogo /></span>
        <button onClick={onLeave} className="rounded-lg bg-zoom-red px-4 py-1.5 text-sm font-bold hover:bg-zoom-red-hover">
          Leave
        </button>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <Clock className="h-12 w-12 text-[#8A8A8A]" />
        <h1 className="mt-4 text-xl font-bold sm:text-2xl">
          {hostIsHere ? "Please wait, the meeting host will let you in soon." : "Waiting for the host to start this meeting."}
        </h1>
        <p className="mt-2 text-sm text-[#B3B3B3]">{meeting.title}</p>
        <p className="text-xs text-[#8A8A8A]">Meeting ID {formatMeetingCode(meeting.meeting_code)}</p>
        <Spinner className="mt-6 h-6 w-6 text-[#8A8A8A]" />
      </main>
    </div>
  );
}
