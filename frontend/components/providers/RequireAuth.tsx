"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth";
import { choseSignOut } from "@/lib/session";
import { useAuth } from "./AuthProvider";

/**
 * Wrap pages that need an account.
 *
 * Nobody signed in? Like the brief says, a default user is assumed: we sign in
 * as the demo account (Alex Johnson) straight away. Only after someone presses
 * "Sign out" do we send them to the Sign in page instead.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const tried = useRef(false);

  useEffect(() => {
    if (loading || user) return;
    const toSignIn = () => {
      const next = window.location.pathname + window.location.search;
      router.replace(`/signin?next=${encodeURIComponent(next)}`);
    };
    if (choseSignOut() || tried.current) return toSignIn();
    tried.current = true;
    signIn(DEMO_EMAIL, DEMO_PASSWORD).catch(toSignIn);
  }, [loading, user, signIn, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zoom-blue">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  return <>{children}</>;
}
