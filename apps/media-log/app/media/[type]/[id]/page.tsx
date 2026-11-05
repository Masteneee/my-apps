// /media/<type>/<source>-<id>, e.g. /media/anime/anilist-16498: one item's page.
// Two dynamic segments: Next.js gives us both in `params`.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaItemView } from "@/components/MediaItemView";
import { TYPE_LABELS } from "@/lib/media/display";
import { parseMediaItemParams } from "@/lib/media/links";

type Props = { params: Promise<{ type: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, id } = await params;
  const ref = parseMediaItemParams(type, id);
  // The title isn't known on the server (demo data is in the browser), so the tab says "Anime", "Book"...
  return { title: ref ? TYPE_LABELS[ref.type].one : "Not found" };
}

export default async function MediaItemPage({ params }: Props) {
  const { type, id } = await params;
  const ref = parseMediaItemParams(type, id);
  // A wrong address (/media/podcast/x) shows the 404 page (app/not-found.tsx).
  if (!ref) notFound();
  return <MediaItemView itemRef={ref} />;
}
