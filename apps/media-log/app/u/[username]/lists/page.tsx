// /u/<username>/lists: someone's lists (Stage 5). Same nested-route idea as the diary.
import type { Metadata } from "next";
import { ListsView } from "@/components/ListsView";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}'s lists` };
}

export default async function ListsPage({ params }: Props) {
  const { username } = await params;
  return <ListsView username={decodeURIComponent(username)} />;
}
