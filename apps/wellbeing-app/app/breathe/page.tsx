import type { Metadata } from "next";
import { BreatheView } from "@/components/BreatheView";

export const metadata: Metadata = { title: "Breathe" };

// The breathing exercise (4-7-8 and box breathing). No account and no data
// needed, so it also works offline once the service worker has saved it.
export default function BreathePage() {
  return <BreatheView />;
}
