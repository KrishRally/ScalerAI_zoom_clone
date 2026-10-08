"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/auth/PasswordInput";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/components/providers/AuthProvider";
import { MIN_PASSWORD, safeNext } from "@/lib/auth";

function SignUpForm() {
  const { user, loading, signUp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please enter your name.");
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    setSubmitting(true);
    try {
      await signUp(name.trim(), email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Sign up free">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input
            id="name"
            autoComplete="name"
            className="input py-2.5"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
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
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            className="py-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-zoom-muted">At least {MIN_PASSWORD} characters.</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-zoom-red">{error}</p>}
        <button type="submit" className="btn-primary w-full py-2.5 text-base" disabled={submitting}>
          {submitting ? <Spinner className="h-4 w-4" /> : "Sign up"}
        </button>
        <p className="text-center text-xs text-zoom-muted">
          By signing up, you agree to the Terms of Service and Privacy Statement.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-zoom-muted">
        Already have an account?{" "}
        <Link href={`/signin${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-zoom-blue hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
