"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Home,
  LogOut,
  MessagesSquare,
  Plus,
  Settings,
  Video,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ZoomLogo from "@/components/ui/ZoomLogo";
import NotificationBell from "@/components/layout/NotificationBell";
import SearchBox from "@/components/layout/SearchBox";
import { useAuth } from "@/components/providers/AuthProvider";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { api } from "@/lib/api";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/docs", label: "Docs", icon: FileText },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

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

/**
 * The Zoom Workplace frame around every signed in page: a grey top bar
 * (logo, back/forward, search, profile), a side bar of sections on the left,
 * and the page itself on a white rounded panel. Phones get tabs at the bottom.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  // The chat page shows its own counts, so don't poll from here while on it.
  const chatUnread = useChatUnread(!!user && !pathname.startsWith("/chat"));

  return (
    <div className="flex h-[100dvh] flex-col bg-zoom-chrome">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Sections" className="hidden w-[104px] shrink-0 flex-col items-center pb-2 md:flex">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <RailLink key={item.href} {...item} active={isActive(pathname, item.href)} badge={item.href === "/chat" ? chatUnread : 0} />
            ))}
          </div>
          <div className="mt-auto">
            <RailLink href="/settings" label="Settings" icon={Settings} active={pathname.startsWith("/settings")} badge={0} />
          </div>
        </nav>
        <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-white md:mb-2 md:mr-2 md:rounded-xl">{children}</div>
      </div>

      {/* Phones: sections as tabs along the bottom */}
      <nav aria-label="Sections" className="flex shrink-0 justify-around border-t border-zoom-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={href === "/chat" && chatUnread > 0 && !active ? `${label}, ${chatUnread} unread` : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-zoom-blue" : "text-zoom-muted"}`}>
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              {label}
              {href === "/chat" && chatUnread > 0 && !active && <Badge count={chatUnread} className="right-[calc(50%-18px)] top-1" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function RailLink({ href, label, icon: Icon, active, badge }: { href: string; label: string; icon: typeof Home; active: boolean; badge: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={badge > 0 && !active ? `${label}, ${badge} unread` : undefined}
      className={`relative flex w-[88px] flex-col items-center gap-1 rounded-xl py-2.5 text-[13px] transition-colors ${
        active ? "bg-white text-zoom-ink shadow-card" : "text-zoom-text hover:bg-black/5"
      }`}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.6} />
      {label}
      {badge > 0 && !active && <Badge count={badge} className="right-5 top-1.5" />}
    </Link>
  );
}

function Badge({ count, className }: { count: number; className: string }) {
  return (
    <span aria-hidden className={`absolute min-w-4 rounded-full bg-zoom-red px-1 text-center text-[10px] font-bold leading-4 text-white ${className}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { startInstant } = useStartMeeting();
  const [menu, setMenu] = useState<"profile" | "new" | null>(null);

  const iconBtn = "rounded-md p-1.5 text-zoom-text hover:bg-black/5 disabled:opacity-40";

  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 px-3 md:px-0">
      <Link href="/" className="shrink-0 md:flex md:w-[104px] md:justify-center" aria-label="Zoom Workplace home">
        <ZoomLogo stacked />
      </Link>

      <div className="hidden items-center gap-1 lg:ml-[18vw] lg:flex xl:ml-[20vw]">
        <button className={iconBtn} aria-label="Back" title="Back" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button className={iconBtn} aria-label="Forward" title="Forward" onClick={() => router.forward()}>
          <ChevronRight className="h-5 w-5" />
        </button>
        <Link href="/meetings?tab=recent" className={iconBtn} aria-label="Recent meetings" title="Recent meetings">
          <History className="h-5 w-5" />
        </Link>
      </div>

      <div className="mx-2 hidden min-w-0 max-w-[550px] flex-1 lg:block">
        <SearchBox />
      </div>
      <div className="relative hidden lg:block">
        <button className={iconBtn} aria-label="Quick actions" title="Quick actions" onClick={() => setMenu(menu === "new" ? null : "new")}>
          <Plus className="h-5 w-5" />
        </button>
        {menu === "new" && (
          <Popover onClose={() => setMenu(null)} className="left-0 top-10 w-52">
            <MenuItem icon={Video} onClick={() => { setMenu(null); startInstant(); }}>New meeting</MenuItem>
            <MenuItem icon={Plus} onClick={() => { setMenu(null); router.push("/join"); }}>Join a meeting</MenuItem>
            <MenuItem icon={CalendarDays} onClick={() => { setMenu(null); router.push("/calendar"); }}>Schedule a meeting</MenuItem>
            <MenuItem icon={FileText} onClick={() => { setMenu(null); router.push("/docs"); }}>New doc</MenuItem>
          </Popover>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 md:pr-4">
        <NotificationBell />
        <Link href="/calendar" className={`hidden sm:block ${iconBtn} ${pathname.startsWith("/calendar") ? "text-zoom-blue" : ""}`} aria-label="Calendar" title="Calendar">
          <CalendarDays className="h-5 w-5" />
        </Link>
        <div className="relative">
          <button onClick={() => setMenu(menu === "profile" ? null : "profile")} className="relative ml-1 rounded-full ring-zoom-blue/40 hover:ring-2" aria-label="Profile">
            <Avatar name={user?.name || "?"} color={user?.avatar_color} size={32} round />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-zoom-chrome bg-zoom-green" />
          </button>
          {menu === "profile" && user && (
            <Popover onClose={() => setMenu(null)} className="right-0 top-11 w-72 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} color={user.avatar_color} size={48} round />
                <div className="min-w-0">
                  <p className="truncate font-bold text-zoom-ink">{user.name}</p>
                  <p className="truncate text-xs text-zoom-muted">{user.email}</p>
                  <span className="mt-1 inline-block rounded bg-zoom-blue-light px-1.5 py-0.5 text-[10px] font-bold text-zoom-blue">BASIC</span>
                </div>
              </div>
              <div className="mt-4 border-t border-zoom-border pt-3 text-sm">
                <p className="text-zoom-muted">Personal Meeting ID</p>
                <p className="font-semibold text-zoom-ink">{user.personal_meeting_id.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3")}</p>
              </div>
              <div className="mt-3 border-t border-zoom-border pt-2">
                <Link href="/settings" onClick={() => setMenu(null)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zoom-surface">
                  <Settings className="h-4 w-4 text-zoom-muted" /> Settings
                </Link>
                <button
                  onClick={async () => {
                    setMenu(null);
                    await signOut();
                    router.replace("/signin");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zoom-surface"
                >
                  <LogOut className="h-4 w-4 text-zoom-muted" /> Sign out
                </button>
              </div>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
}

function Popover({ onClose, className, children }: { onClose: () => void; className: string; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute z-50 animate-fade-up rounded-xl border border-zoom-border bg-white py-1.5 shadow-pop ${className}`}>{children}</div>
    </>
  );
}

function MenuItem({ icon: Icon, onClick, children }: { icon: typeof Home; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-zoom-surface">
      <Icon className="h-4 w-4 text-zoom-muted" /> {children}
    </button>
  );
}
