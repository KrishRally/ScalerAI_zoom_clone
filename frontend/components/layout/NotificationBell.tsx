"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, FileText, MessageSquare, Video } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { AppNotification, Notifications } from "@/lib/types";

const POLL_MS = 20_000;

const KIND_ICON = { chat: MessageSquare, doc: FileText, meeting: Video };

/** The bell in the top bar: new chat messages, shared docs and meetings starting soon. */
export default function NotificationBell() {
  const router = useRouter();
  const { startExisting } = useStartMeeting();
  const [data, setData] = useState<Notifications | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => api.notifications().then(setData).catch(() => {}), []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Show what's new (highlighted), then count it all as seen.
      await load();
      api.markNotificationsSeen().catch(() => {});
    } else {
      load();
    }
  };

  const go = (n: AppNotification) => {
    setOpen(false);
    load();
    router.push(n.link);
  };

  const unseen = open ? 0 : (data?.unseen ?? 0);
  const items = data?.items ?? [];

  return (
    <div className="relative">
      <button
        className={`relative rounded-md p-2 hover:bg-zoom-surface hover:text-zoom-ink ${open ? "text-zoom-blue" : "text-zoom-muted"}`}
        aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"}
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell className="h-5 w-5" />
        {unseen > 0 && (
          <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-zoom-red px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={toggle} />
          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed left-2 right-2 top-14 z-50 animate-fade-up overflow-hidden rounded-xl border border-zoom-border bg-white shadow-pop sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-96"
          >
            <div className="border-b border-zoom-border px-4 py-3">
              <h2 className="font-bold text-zoom-ink">Notifications</h2>
            </div>
            {items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <Bell className="h-9 w-9 text-zoom-border" />
                <p className="mt-2 text-sm font-semibold text-zoom-ink">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-zoom-muted">New messages, shared docs and meetings starting soon will show up here.</p>
              </div>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-zoom-border overflow-y-auto">
                {items.map((n) => {
                  const Icon = KIND_ICON[n.kind];
                  return (
                    <li key={n.id} className={n.unseen ? "bg-zoom-blue-light/60" : ""}>
                      <div className="flex gap-3 px-4 py-3">
                        <button onClick={() => go(n)} className="flex min-w-0 flex-1 gap-3 text-left">
                          <span className="relative shrink-0">
                            {n.actor ? (
                              <Avatar name={n.actor.name} color={n.actor.avatar_color} size={36} />
                            ) : (
                              <span className="flex h-9 w-9 items-center justify-center rounded-[28%] bg-zoom-blue text-white">
                                <Icon className="h-4 w-4" />
                              </span>
                            )}
                            {n.actor && (
                              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-zoom-blue text-white">
                                <Icon className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-zoom-ink">{n.title}</span>
                            <span className="block truncate text-xs text-zoom-muted">{n.body}</span>
                            <span className="mt-0.5 block text-[11px] text-zoom-muted">{timeAgo(n.created_at)}</span>
                          </span>
                        </button>
                        {n.kind === "meeting" && n.meeting_code && (
                          <button
                            className="btn-primary h-8 self-center px-3 py-0 text-xs"
                            onClick={() => {
                              setOpen(false);
                              startExisting(n.meeting_code!);
                            }}
                          >
                            Start
                          </button>
                        )}
                        {n.unseen && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zoom-blue" aria-label="New" />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
