import type { Metadata } from "next";
import { CheckinView } from "@/components/checkin/CheckinView";

export const metadata: Metadata = { title: "Today's check-in" };

// The daily check-in. Everything happens in the browser (CheckinView): it
// needs your time zone, and in demo mode the data is only in this browser.
// The service worker saves this page in advance, so it opens offline.
export default function CheckinPage() {
  return <CheckinView />;
}
