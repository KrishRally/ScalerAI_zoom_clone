"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "./AuthProvider";

/** Wrap pages that need an account. Guests are sent to Sign in and brought back afterwards. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const next = window.location.pathname + window.location.search;
      router.replace(`/signin?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zoom-blue">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  return <>{children}</>;
}
