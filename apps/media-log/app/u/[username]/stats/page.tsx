// /u/<username>/stats (Stage 6): counts per media type, rating distribution,
// top genres and a yearly recap. Same pattern as the diary page next door.
import type { Metadata } from "next";
import { StatsView } from "@/components/StatsView";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}'s stats` };
}

export default async function StatsPage({ params }: Props) {
  const { username } = await params;
  // Loaded in the browser (StatsView), like the profile: demo data lives in localStorage.
  return <StatsView username={decodeURIComponent(username)} />;
}
