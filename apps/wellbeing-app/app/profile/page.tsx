import type { Metadata } from "next";
import { ProfileView } from "@/components/ProfileView";

export const metadata: Metadata = { title: "My profile" };

// Your own profile. Loaded in the browser (ProfileView), because in demo mode
// the data only exists in the browser's localStorage, never on the server.
export default function ProfilePage() {
  return <ProfileView />;
}
