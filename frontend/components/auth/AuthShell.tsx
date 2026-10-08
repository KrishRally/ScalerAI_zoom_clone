import Link from "next/link";
import ZoomLogo from "@/components/ui/ZoomLogo";

/** Shared layout for the Sign in and Sign up pages, like zoom.us/signin. */
export default function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-14 items-center justify-between border-b border-zoom-border px-4 sm:px-6">
        <Link href="/" aria-label="Zoom Workplace"><ZoomLogo /></Link>
        <Link href="/join" className="text-sm font-semibold text-zoom-blue hover:underline">
          Join a meeting
        </Link>
      </header>
      <main className="flex flex-1 justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-3xl font-bold text-zoom-ink">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
