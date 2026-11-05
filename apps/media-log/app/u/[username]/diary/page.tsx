// /u/<username>/diary: a nested route. The folder app/u/[username]/diary/
// adds "/diary" after the profile address, and still gets `username` in params.
import type { Metadata } from "next";
import { DiaryView } from "@/components/DiaryView";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}'s diary` };
}

export default async function DiaryPage({ params }: Props) {
  const { username } = await params;
  // Loaded in the browser (DiaryView), like the profile: demo data lives in localStorage.
  return <DiaryView username={decodeURIComponent(username)} />;
}
