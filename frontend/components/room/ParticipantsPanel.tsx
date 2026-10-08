"use client";

import { useState } from "react";
import { Hand, Mic, MicOff, MoreHorizontal, Search, Video, VideoOff } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import PanelShell from "./PanelShell";
import type { Participant } from "@/lib/types";

interface Props {
  participants: Participant[];
  waiting: Participant[];
  meId: number;
  isHost: boolean;
  canRenameSelf: boolean;
  onClose: () => void;
  onInvite: () => void;
  onMuteAll: () => void;
  onMute: (p: Participant) => void;
  onRemove: (p: Participant) => void;
  onRename: (p: Participant) => void;
  onMakeHost: (p: Participant) => void;
  onAdmit: (p: Participant) => void;
  onAdmitAll: () => void;
}

/** Right side "Participants" panel, with the waiting room and host controls. */
export default function ParticipantsPanel(props: Props) {
  const { participants, waiting, meId, isHost } = props;
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<number | null>(null);

  const matches = (p: Participant) => p.display_name.toLowerCase().includes(query.trim().toLowerCase());
  // Zoom lists you first, then the host, then raised hands, then everyone else.
  const sorted = participants
    .filter(matches)
    .sort((a, b) => rank(a, meId) - rank(b, meId) || a.display_name.localeCompare(b.display_name));

  // What the "..." menu offers for a given person.
  const menuItems = (p: Participant) => {
    const items: { label: string; danger?: boolean; run: () => void }[] = [];
    const isMe = p.id === meId;
    if ((isMe && props.canRenameSelf) || (isHost && !isMe)) items.push({ label: "Rename", run: () => props.onRename(p) });
    if (isHost && !isMe) {
      items.push({ label: "Make host", run: () => props.onMakeHost(p) });
      items.push({ label: "Remove", danger: true, run: () => props.onRemove(p) });
    }
    return items;
  };

  return (
    <PanelShell title={`Participants (${participants.length})`} onClose={props.onClose}>
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

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-2">
        {/* Waiting room, only the host sees it */}
        {isHost && waiting.length > 0 && (
          <section className="mb-2 border-b border-zoom-border pb-2">
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-zoom-muted">Waiting room ({waiting.length})</p>
              <button onClick={props.onAdmitAll} className="text-xs font-semibold text-zoom-blue hover:underline">
                Admit all
              </button>
            </div>
            <ul>
              {waiting.filter(matches).map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 px-3 py-1.5">
                  <Avatar name={p.display_name} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.display_name}</span>
                  <button onClick={() => props.onAdmit(p)} className="rounded bg-zoom-blue px-2 py-0.5 text-xs font-semibold text-white hover:bg-zoom-blue-hover">
                    Admit
                  </button>
                  <button onClick={() => props.onRemove(p)} className="rounded border border-zoom-border px-2 py-0.5 text-xs font-semibold hover:bg-zoom-surface">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zoom-muted">In the meeting ({participants.length})</p>
        <ul>
          {sorted.map((p) => {
            const tags = [p.role === "host" && "Host", p.id === meId && "me"].filter(Boolean).join(", ");
            const items = menuItems(p);
            const canMute = isHost && p.id !== meId && !p.is_muted;
            const hasActions = items.length > 0 || canMute;
            return (
              <li key={p.id} className="group relative flex items-center gap-2.5 px-3 py-1.5 hover:bg-zoom-surface">
                <Avatar name={p.display_name} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.display_name}
                  {tags && <span className="text-zoom-muted"> ({tags})</span>}
                </span>

                {hasActions && (
                  <div className="flex items-center gap-1 md:hidden md:group-hover:flex">
                    {canMute && (
                      <button onClick={() => props.onMute(p)} className="rounded border border-zoom-border bg-white px-2 py-0.5 text-xs font-semibold hover:bg-zoom-surface">
                        Mute
                      </button>
                    )}
                    {items.length > 0 && (
                      <button
                        onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                        className="rounded border border-zoom-border bg-white p-0.5 hover:bg-zoom-surface"
                        aria-label={`More options for ${p.display_name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}

                <span className={`flex items-center gap-1.5 ${hasActions ? "md:group-hover:hidden" : ""}`}>
                  {p.is_hand_raised && <Hand className="h-4 w-4 text-amber-500" />}
                  {p.is_muted ? <MicOff className="h-4 w-4 text-zoom-red" /> : <Mic className="h-4 w-4 text-zoom-muted" />}
                  {p.is_video_on ? <Video className="h-4 w-4 text-zoom-muted" /> : <VideoOff className="h-4 w-4 text-zoom-red" />}
                </span>

                {menuFor === p.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                    <div className="absolute right-3 top-8 z-20 w-40 animate-fade-up rounded-lg border border-zoom-border bg-white py-1 text-sm shadow-pop">
                      {items.map((item) => (
                        <button
                          key={item.label}
                          className={`block w-full px-3 py-1.5 text-left hover:bg-zoom-surface ${item.danger ? "text-zoom-red" : ""}`}
                          onClick={() => {
                            setMenuFor(null);
                            item.run();
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </li>
            );
          })}
          {sorted.length === 0 && <li className="px-3 py-4 text-center text-sm text-zoom-muted">No one found</li>}
        </ul>
      </div>

      <div className="flex gap-2 border-t border-zoom-border p-3">
        <button className="btn-secondary flex-1 px-2 py-1.5" onClick={props.onInvite}>Invite</button>
        {isHost && (
          <button className="btn-secondary flex-1 px-2 py-1.5" onClick={props.onMuteAll}>Mute All</button>
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
