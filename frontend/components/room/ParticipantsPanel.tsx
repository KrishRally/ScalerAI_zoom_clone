"use client";

import { useState } from "react";
import { Hand, Mic, MicOff, MoreHorizontal, Search, Video, VideoOff, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { Participant } from "@/lib/types";

interface Props {
  participants: Participant[];
  meId: number;
  isHost: boolean;
  onClose: () => void;
  onInvite: () => void;
  onMuteAll: () => void;
  onMute: (p: Participant) => void;
  onRemove: (p: Participant) => void;
}

/** Right side "Participants" panel, with host controls. */
export default function ParticipantsPanel({ participants, meId, isHost, onClose, onInvite, onMuteAll, onMute, onRemove }: Props) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<number | null>(null);

  // Zoom lists you first, then the host, then raised hands, then everyone else.
  const sorted = [...participants]
    .filter((p) => p.display_name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => rank(a, meId) - rank(b, meId) || a.display_name.localeCompare(b.display_name));

  return (
    <PanelShell title={`Participants (${participants.length})`} onClose={onClose}>
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-lg border border-zoom-border px-2.5 py-1.5 text-sm focus-within:border-zoom-blue">
          <Search className="h-4 w-4 text-zoom-muted" />
          <input
            className="w-full bg-transparent outline-none placeholder:text-zoom-muted"
            placeholder="Find a participant"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto py-2">
        {sorted.map((p) => {
          const tags = [p.role === "host" && "Host", p.id === meId && "me"].filter(Boolean).join(", ");
          const canManage = isHost && p.id !== meId;
          return (
            <li key={p.id} className="group relative flex items-center gap-2.5 px-3 py-1.5 hover:bg-zoom-surface">
              <Avatar name={p.display_name} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.display_name}
                {tags && <span className="text-zoom-muted"> ({tags})</span>}
              </span>

              {canManage && (
                <div className="flex items-center gap-1 md:hidden md:group-hover:flex">
                  {!p.is_muted && (
                    <button onClick={() => onMute(p)} className="rounded border border-zoom-border bg-white px-2 py-0.5 text-xs font-semibold hover:bg-zoom-surface">
                      Mute
                    </button>
                  )}
                  <button
                    onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                    className="rounded border border-zoom-border bg-white p-0.5 hover:bg-zoom-surface"
                    aria-label={`More options for ${p.display_name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              )}

              <span className={`flex items-center gap-1.5 ${canManage ? "md:group-hover:hidden" : ""}`}>
                {p.is_hand_raised && <Hand className="h-4 w-4 text-amber-500" />}
                {p.is_muted ? <MicOff className="h-4 w-4 text-zoom-red" /> : <Mic className="h-4 w-4 text-zoom-muted" />}
                {p.is_video_on ? <Video className="h-4 w-4 text-zoom-muted" /> : <VideoOff className="h-4 w-4 text-zoom-red" />}
              </span>

              {menuFor === p.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                  <div className="absolute right-3 top-8 z-20 w-36 animate-fade-up rounded-lg border border-zoom-border bg-white py-1 text-sm shadow-pop">
                    <button
                      className="block w-full px-3 py-1.5 text-left text-zoom-red hover:bg-zoom-surface"
                      onClick={() => {
                        setMenuFor(null);
                        onRemove(p);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
        {sorted.length === 0 && <li className="px-3 py-4 text-center text-sm text-zoom-muted">No one found</li>}
      </ul>

      <div className="flex gap-2 border-t border-zoom-border p-3">
        <button className="btn-secondary flex-1 px-2 py-1.5" onClick={onInvite}>Invite</button>
        {isHost && (
          <button className="btn-secondary flex-1 px-2 py-1.5" onClick={onMuteAll}>Mute All</button>
        )}
      </div>
    </PanelShell>
  );
}

function rank(p: Participant, meId: number) {
  if (p.id === meId) return 0;
  if (p.role === "host") return 1;
  if (p.is_hand_raised) return 2;
  return 3;
}

/** White side panel used by Participants and Chat. Full screen on phones. */
export function PanelShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className="absolute inset-0 z-30 flex flex-col bg-white text-zoom-text sm:static sm:z-auto sm:w-80 sm:shrink-0 sm:rounded-lg sm:my-2 sm:mr-2">
      <div className="flex items-center justify-between border-b border-zoom-border px-3 py-2.5">
        <h2 className="text-sm font-bold">{title}</h2>
        <button onClick={onClose} className="rounded p-1 text-zoom-muted hover:bg-zoom-surface" aria-label="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </aside>
  );
}
