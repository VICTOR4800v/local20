import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "J.A.R.V.I.S. — Operator Console",
  description:
    "Just A Rather Very Intelligent System. Operator console with hologram core, voice live, email, calendar, habits, schedules, briefing, news and system telemetry.",
  keywords: ["JARVIS", "AI assistant", "Iron Man", "voice assistant", "dashboard"],
  authors: [{ name: "JARVIS" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <SonnerToaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "oklch(0.17 0.025 220 / 95%)",
              border: "1px solid rgba(34, 211, 238, 0.3)",
              color: "rgb(207, 250, 254)",
              fontFamily: "monospace",
              fontSize: "12px",
            },
          }}
        />
      </body>
    </html>
  );
}
