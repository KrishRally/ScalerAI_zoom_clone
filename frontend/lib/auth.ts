// Small helpers shared by the Sign in and Sign up pages.

/** Only send people back to pages on this site after signing in (never to another website). */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/signin") || next.startsWith("/signup")) return "/";
  return next;
}

export const DEMO_EMAIL = "alex.johnson@example.com";
export const DEMO_PASSWORD = "zoomdemo123";
export const MIN_PASSWORD = 8;
