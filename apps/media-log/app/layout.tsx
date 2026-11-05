// The root layout wraps EVERY page: <html>, <body>, the nav bar and the auth
// state. Pages are rendered where {children} is.
import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { DemoBanner } from "@/components/DemoBanner";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  // "%s" is replaced by each page's own title, e.g. "Log in · Media Log".
  title: { default: "Media Log", template: "%s · Media Log" },
  description: "Log, rate and review everything you watch, read and play.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <AuthProvider>
          <DemoBanner />
          <NavBar />
          {/* max-w + mx-auto centres the content; px-4 keeps a gap on phones. */}
          <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
