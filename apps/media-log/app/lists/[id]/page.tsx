// /lists/<id>: one list (Stage 5). The owner can reorder, remove and delete.
// Loaded in the browser (ListView), like every page that reads demo data.
import type { Metadata } from "next";
import { ListView } from "@/components/ListView";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "List" };

export default async function ListPage({ params }: Props) {
  const { id } = await params;
  return <ListView listId={decodeURIComponent(id)} />;
}
