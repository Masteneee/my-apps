// A "dynamic route": the folder name [username] means this one file handles
// /u/anything. Next.js gives us the "anything" part in `params`.
import type { Metadata } from "next";
import { ProfileView } from "@/components/ProfileView";

// In Next.js 15+ params is a Promise, so we "await" it.
type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  // The profile is loaded in the browser (ProfileView), because in demo mode the
  // data only exists in the browser's localStorage, never on the server.
  return <ProfileView username={decodeURIComponent(username)} />;
}
