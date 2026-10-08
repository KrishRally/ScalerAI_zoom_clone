"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api";
import { formatMeetingCode } from "@/lib/format";
import SettingsCard from "./SettingsCard";

const COLORS = ["#0E71EB", "#E8710A", "#1E8E3E", "#A142F4", "#D93025", "#12A4AF", "#C2185B"];

export default function ProfileSection() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  const save = async (changes: { name?: string; avatar_color?: string }, message: string) => {
    setSaving(true);
    try {
      setUser(await api.updateProfile(changes));
      toast(message, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const nameChanged = name.trim() !== "" && name.trim() !== user.name;

  return (
    <SettingsCard id="profile" title="Profile" description="How you appear in meetings and invitations.">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex flex-col items-center gap-3">
          <Avatar name={user.name} color={user.avatar_color} size={88} />
          <div className="flex max-w-[150px] flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Profile colour">
            {COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={user.avatar_color === c}
                aria-label={`Colour ${c}`}
                onClick={() => save({ avatar_color: c }, "Profile colour updated")}
                className="flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 hover:ring-2 hover:ring-zoom-border"
                style={{ backgroundColor: c }}
              >
                {user.avatar_color === c && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nameChanged) save({ name: name.trim() }, "Name updated");
            }}
          >
            <label className="label" htmlFor="display-name">Display name</label>
            <div className="flex gap-2">
              <input id="display-name" className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
              <button type="submit" className="btn-primary shrink-0" disabled={!nameChanged || saving}>
                {saving ? <Spinner className="h-4 w-4" /> : "Save"}
              </button>
            </div>
          </form>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-zoom-muted">Email</dt>
              <dd className="break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="font-semibold text-zoom-muted">Personal Meeting ID</dt>
              <dd>{formatMeetingCode(user.personal_meeting_id)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </SettingsCard>
  );
}
