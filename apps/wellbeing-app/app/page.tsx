import { HomeView } from "@/components/HomeView";

// The home page ("/"). Everything here depends on who is logged in, which only
// the browser knows, so the real content is in a client component.
export default function HomePage() {
  return <HomeView />;
}
