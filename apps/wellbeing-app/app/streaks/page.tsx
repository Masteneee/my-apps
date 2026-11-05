import type { Metadata } from "next";
import { StreaksView } from "@/components/streaks/StreaksView";

export const metadata: Metadata = { title: "Streaks" };

// Streaks and calendar heatmaps. Loaded in the browser (StreaksView), like the
// check-in: "today" depends on the phone's time zone, and in demo mode the data
// only exists in this browser. The service worker saves this page in advance.
export default function StreaksPage() {
  return <StreaksView />;
}
