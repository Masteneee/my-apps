// The WEB APP MANIFEST: a small JSON file that tells the phone "this website
// can be installed as an app", with its name, icon and colours.
// Next.js serves what this function returns at /manifest.webmanifest and adds
// <link rel="manifest"> to every page by itself.
import type { MetadataRoute } from "next";

// Keep in sync with --page and --accent in app/globals.css.
const PAGE_COLOR = "#f7f6f3";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable id, so the phone knows it's the same app even if start_url changes.
    id: "/",
    name: "Wellbeing: daily check-in",
    short_name: "Wellbeing", // shown under the home screen icon (keep it short)
    description: "A calm 5-minute daily check-in: mood, screen time, gratitude, journal and habits.",
    start_url: "/", // the page that opens when you tap the icon
    scope: "/", // which pages belong to the app
    display: "standalone", // no browser address bar: looks like a real app
    orientation: "portrait",
    background_color: PAGE_COLOR, // splash screen colour while the app starts
    theme_color: PAGE_COLOR, // status bar / title bar colour
    icons: [
      // "any" icons are shown as they are (with our rounded corners).
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // A "maskable" icon fills the whole square; Android cuts its own shape out of it.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
