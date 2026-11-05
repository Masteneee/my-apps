import type { Metadata } from "next";
import { FriendsView } from "@/components/friends/FriendsView";

export const metadata: Metadata = { title: "Friends" };

// Friends and shared streaks (Stage 4). Loaded in the browser (FriendsView),
// like the other pages: demo-mode data only exists in this browser, and
// "today" depends on the phone's time zone. The service worker saves this
// page in advance, so it opens offline (in Supabase mode it then says the
// data needs the internet).
export default function FriendsPage() {
  return <FriendsView />;
}
