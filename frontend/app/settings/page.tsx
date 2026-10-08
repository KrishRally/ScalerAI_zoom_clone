"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import TopNav from "@/components/layout/TopNav";
import RequireAuth from "@/components/providers/RequireAuth";
import { useAuth } from "@/components/providers/AuthProvider";
import AudioVideoSection from "@/components/settings/AudioVideoSection";
import MeetingDefaultsSection from "@/components/settings/MeetingDefaultsSection";
import PasswordSection from "@/components/settings/PasswordSection";
import ProfileSection from "@/components/settings/ProfileSection";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "meetings", label: "Meetings" },
  { id: "audio-video", label: "Audio & video" },
  { id: "security", label: "Password" },
];

/** Zoom style settings: a menu on the left, sections on the right. */
function SettingsView() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zoom-surface">
      <TopNav />
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row md:py-10">
        <aside className="md:w-52 md:shrink-0">
          <h1 className="mb-3 text-2xl font-bold text-zoom-ink">Settings</h1>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto md:sticky md:top-20 md:flex-col">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-zoom-text hover:bg-white"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <ProfileSection />
          <MeetingDefaultsSection />
          <AudioVideoSection />
          <PasswordSection />
          <div className="flex justify-end">
            <button
              className="btn-secondary text-zoom-red"
              onClick={async () => {
                await signOut();
                router.replace("/signin");
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsView />
    </RequireAuth>
  );
}
