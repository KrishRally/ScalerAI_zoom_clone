"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  CalendarDays,
  FileText,
  Home,
  LayoutGrid,
  MessageSquare,
  Search,
  Settings,
  Video,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ZoomLogo from "@/components/ui/ZoomLogo";
import { useCurrentUser } from "@/components/providers/UserProvider";
import { useToast } from "@/components/ui/Toast";

// Only Home and Meetings are real pages. The rest are placeholders, like in the brief.
const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: null, label: "Team Chat", icon: MessageSquare },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: null, label: "Calendar", icon: CalendarDays },
  { href: null, label: "Docs", icon: FileText },
  { href: null, label: "Apps", icon: LayoutGrid },
];

export default function TopNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const comingSoon = (label: string) => toast(`${label} is not part of this demo`, "info");

  return (
    <header className="sticky top-0 z-40 border-b border-zoom-border bg-white">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Link href="/" className="shrink-0" aria-label="Zoom Workplace home">
          <ZoomLogo />
        </Link>

        <nav className="ml-2 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:ml-6 md:flex-none">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
            const className = `group relative flex shrink-0 flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors lg:px-3 ${
              active ? "text-zoom-blue" : "text-zoom-muted hover:bg-zoom-surface hover:text-zoom-ink"
            }`;
            const content = (
              <>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span className="hidden sm:block">{label}</span>
                {active && <span className="absolute -bottom-[9px] left-2 right-2 h-[3px] rounded-full bg-zoom-blue" />}
              </>
            );
            return href ? (
              <Link key={label} href={href} className={className} aria-current={active ? "page" : undefined}>
                {content}
              </Link>
            ) : (
              <button key={label} className={className} onClick={() => comingSoon(label)}>
                {content}
              </button>
            );
          })}
        </nav>

        <div className="mx-auto hidden max-w-md flex-1 lg:block">
          <label className="flex items-center gap-2 rounded-lg bg-zoom-surface px-3 py-2 text-sm text-zoom-muted ring-zoom-blue/30 focus-within:ring-2">
            <Search className="h-4 w-4" />
            <input
              className="w-full bg-transparent text-zoom-text outline-none placeholder:text-zoom-muted"
              placeholder="Search (Ctrl+F)"
              onKeyDown={(e) => e.key === "Enter" && comingSoon("Search")}
            />
          </label>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            className="hidden rounded-md p-2 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-ink sm:block"
            aria-label="Notifications"
            onClick={() => comingSoon("Notifications")}
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            className="hidden rounded-md p-2 text-zoom-muted hover:bg-zoom-surface hover:text-zoom-ink sm:block"
            aria-label="Settings"
            onClick={() => comingSoon("Settings")}
          >
            <Settings className="h-5 w-5" />
          </button>
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
                    {["Settings", "Help", "Sign out"].map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          setMenuOpen(false);
                          comingSoon(item);
                        }}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-zoom-surface"
                      >
                        {item}
                      </button>
                    ))}
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
