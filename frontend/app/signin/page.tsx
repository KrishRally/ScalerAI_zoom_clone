"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/auth/PasswordInput";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/components/providers/AuthProvider";
import { DEMO_EMAIL, DEMO_PASSWORD, safeNext } from "@/lib/auth";

function SignInForm() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: go straight on.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <AuthShell title="Sign in">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input py-2.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            className="py-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
        <button type="submit" className="btn-primary w-full py-2.5 text-base" disabled={submitting}>
          {submitting ? <Spinner className="h-4 w-4" /> : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zoom-muted">
        New to Zoom?{" "}
        <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-zoom-blue hover:underline">
          Sign up free
        </Link>
      </p>

      {/* Lets reviewers try the app without making an account */}
      <div className="mt-8 rounded-lg border border-zoom-border bg-zoom-surface p-4 text-sm">
        <p className="font-semibold text-zoom-ink">Just looking around?</p>
        <p className="mt-1 text-zoom-muted">
          Use the demo account, which already has meetings: <span className="font-medium text-zoom-text">{DEMO_EMAIL}</span> /{" "}
          <span className="font-medium text-zoom-text">{DEMO_PASSWORD}</span>
        </p>
        <button type="button" onClick={fillDemo} className="mt-2 font-semibold text-zoom-blue hover:underline">
          Fill in demo account
        </button>
      </div>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
