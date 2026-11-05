import type { Metadata } from "next";
import { MovieSearch } from "@/components/MovieSearch";

export const metadata: Metadata = { title: "Search movies" };

// A thin Server Component: the interactive part (typing, results, the log
// form) is the client component MovieSearch.
export default function SearchPage() {
  return <MovieSearch />;
}
