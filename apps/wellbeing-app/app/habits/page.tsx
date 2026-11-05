import type { Metadata } from "next";
import { HabitsView } from "@/components/HabitsView";

export const metadata: Metadata = { title: "My habits" };

// Add, archive and restore habits. Loaded in the browser (HabitsView), like
// the check-in, because demo-mode data only exists in this browser.
export default function HabitsPage() {
  return <HabitsView />;
}
