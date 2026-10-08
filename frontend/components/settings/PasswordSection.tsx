"use client";

import { useState } from "react";
import PasswordInput from "@/components/auth/PasswordInput";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { MIN_PASSWORD } from "@/lib/auth";
import SettingsCard from "./SettingsCard";

export default function PasswordSection() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD) return setError(`New password must be at least ${MIN_PASSWORD} characters.`);
    if (next !== confirm) return setError("The new passwords don't match.");
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Password changed. Other devices have been signed out.", "success");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard id="security" title="Password" description="Changing your password signs you out everywhere else.">
      <form onSubmit={submit} className="grid max-w-md gap-3">
        <div>
          <label className="label" htmlFor="current-password">Current password</label>
          <PasswordInput id="current-password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="new-password">New password</label>
          <PasswordInput id="new-password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">Confirm new password</label>
          <PasswordInput id="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
        <div>
          <button type="submit" className="btn-primary" disabled={saving || !current || !next || !confirm}>
            {saving ? <Spinner className="h-4 w-4" /> : "Change password"}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
