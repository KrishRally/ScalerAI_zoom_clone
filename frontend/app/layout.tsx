import type { Metadata, Viewport } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/providers/AuthProvider";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: "Zoom Workplace",
  description: "Video meetings: start, join and schedule meetings.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lato.variable}>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
