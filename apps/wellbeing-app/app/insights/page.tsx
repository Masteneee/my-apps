import type { Metadata } from "next";
import { InsightsView } from "@/components/insights/InsightsView";

export const metadata: Metadata = { title: "Insights" };

// The weekly summary (Stage 5). Loaded in the browser (InsightsView), like
// streaks: "this week" depends on the phone's time zone, and in demo mode the
// data only exists in this browser. The service worker saves this page in advance.
export default function InsightsPage() {
  return <InsightsView />;
}
