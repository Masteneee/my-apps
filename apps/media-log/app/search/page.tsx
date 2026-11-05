import type { Metadata } from "next";
import { MediaSearch } from "@/components/MediaSearch";

export const metadata: Metadata = { title: "Search" };

// A thin Server Component: the interactive part (typing, results, the log
// form) is the client component MediaSearch.
export default function SearchPage() {
  return <MediaSearch />;
}
