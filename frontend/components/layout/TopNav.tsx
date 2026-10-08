"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  FileText,
  Home,
  MessageSquare,
  LogOut,
  Settings,
  Video,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import NotificationBell from "@/components/layout/NotificationBell";
import SearchBox from "@/components/layout/SearchBox";
import ZoomLogo from "@/components/ui/ZoomLogo";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/chat", label: "Team Chat", icon: MessageSquare },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/docs", label: "Docs", icon: FileText },
];

/** Unread Team Chat messages, checked every 15 seconds while signed in. */
function useChatUnread(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const check = () => api.chatUnread().then((r) => setUnread(r.unread)).catch(() => {});
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [enabled]);
  return unread;
}

export default function TopNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  // The chat page shows its own counts, so don't poll from here while on it.
  const chatUnread = useChatUnread(!!user && !pathname.startsWith("/chat"));

  return (
    <header className="sticky top-0 z-40 border-b border-zoom-border bg-white">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Link href="/" className="shrink-0" aria-label="Zoom Workplace home">
          <ZoomLogo />
        </Link>

        <nav className="no-scrollbar ml-2 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:ml-6 md:flex-none">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const badge = href === "/chat" && chatUnread > 0 && !active;
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex shrink-0 flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors lg:px-3 ${
                  active ? "text-zoom-blue" : "text-zoom-muted hover:bg-zoom-surface hover:text-zoom-ink"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span className="hidden sm:block">{label}</span>
                {badge && (
                  <span className="absolute right-1 top-0 min-w-4 rounded-full bg-zoom-red px-1 text-center text-[10px] font-bold leading-4 text-white">
                    {chatUnread > 99 ? "99+" : chatUnread}
                  </span>
                )}
                {active && <span className="absolute -bottom-[9px] left-2 right-2 h-[3px] rounded-full bg-zoom-blue" />}
              </Link>
            );
          })}
        </nav>

        <div className="mx-auto hidden max-w-md flex-1 lg:block">
          <SearchBox />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <NotificationBell />
          <Link
            href="/settings"
            className={`hidden rounded-md p-2 hover:bg-zoom-surface hover:text-zoom-ink sm:block ${
              pathname.startsWith("/settings") ? "text-zoom-blue" : "text-zoom-muted"
            }`}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="relative ml-1 rounded-[28%] ring-zoom-blue/40 hover:ring-2"
              aria-label="Profile"
            >
              <Avatar name={user?.name || "?"} color={user?.avatar_color} size={32} />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-zoom-green" />
            </button>
            {menuOpen && user && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-72 animate-fade-up rounded-xl border border-zoom-border bg-white p-4 shadow-pop">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} color={user.avatar_color} size={48} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-zoom-ink">{user.name}</p>
                      <p className="truncate text-xs text-zoom-muted">{user.email}</p>
                      <span className="mt-1 inline-block rounded bg-zoom-blue-light px-1.5 py-0.5 text-[10px] font-bold text-zoom-blue">
                        BASIC
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-zoom-border pt-3 text-sm">
                    <p className="text-zoom-muted">Personal Meeting ID</p>
                    <p className="font-semibold text-zoom-ink">{user.personal_meeting_id.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3")}</p>
                  </div>
                  <div className="mt-3 border-t border-zoom-border pt-2">
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zoom-surface"
                    >
                      <Settings className="h-4 w-4 text-zoom-muted" /> Settings
                    </Link>
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await signOut();
                        router.replace("/signin");
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zoom-surface"
                    >
                      <LogOut className="h-4 w-4 text-zoom-muted" /> Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
