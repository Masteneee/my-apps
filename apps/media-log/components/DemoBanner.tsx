import { authMode } from "@/lib/auth";

// A thin strip at the top, shown only in demo (mock) mode, so it's always
// clear that nothing is really saved online yet.
export function DemoBanner() {
  if (authMode !== "mock") return null;
  return (
    <div className="bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-200 sm:text-sm">
      Demo mode: no Supabase keys found, so accounts and logs are saved only in this browser.
    </div>
  );
}
