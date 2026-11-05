import type { Metadata } from "next";
import Link from "next/link";
import { card, link } from "@/components/ui";

export const metadata: Metadata = { title: "Offline" };

// The service worker (public/sw.js) shows this page when you're offline and
// open a page that was never saved on this device.
export default function OfflinePage() {
  return (
    <div className={card}>
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 text-muted">
        This page isn&apos;t saved on this device yet. Pages you&apos;ve opened before still work, and this one will
        load once you&apos;re back online.
      </p>
      <Link href="/" className={`mt-4 inline-block ${link}`}>
        Go to the home page
      </Link>
    </div>
  );
}
