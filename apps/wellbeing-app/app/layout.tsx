// The root layout wraps EVERY page: <html>, <body>, the top bar and the auth
// state. Pages are rendered where {children} is.
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { DemoBanner } from "@/components/DemoBanner";
import { NavBar } from "@/components/NavBar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  // "%s" is replaced by each page's own title, e.g. "Log in · Wellbeing".
  title: { default: "Wellbeing", template: "%s · Wellbeing" },
  description: "A calm 5-minute daily check-in: mood, screen time, gratitude, journal and habits.",
  applicationName: "Wellbeing",
  // iPhones ignore parts of the manifest; these tags tell Safari the same things.
  appleWebApp: { capable: true, title: "Wellbeing", statusBarStyle: "default" },
};

// Phone screen settings (Next.js turns this into <meta name="viewport"> and
// <meta name="theme-color">). The colour matches --page in globals.css.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page use the whole screen on phones with a notch; the bar and
  // main area add "safe-area" padding so nothing hides behind it.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#121614" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-page text-ink antialiased">
        <AuthProvider>
          <DemoBanner />
          <NavBar />
          {/* Mobile first: a narrow column (max-w-md) that also looks calm on a computer. */}
          <main className="mx-auto w-full max-w-md px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
