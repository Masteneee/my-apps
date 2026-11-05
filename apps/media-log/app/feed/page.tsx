// /feed: the home feed (Stage 5). Loaded in the browser (FeedView), because in
// demo mode the data only exists in this browser's localStorage.
import type { Metadata } from "next";
import { FeedView } from "@/components/FeedView";

export const metadata: Metadata = { title: "Feed" };

export default function FeedPage() {
  return <FeedView />;
}
