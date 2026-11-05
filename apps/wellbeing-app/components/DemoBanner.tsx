import { authMode } from "@/lib/auth";

// A thin strip at the top, shown only in demo (mock) mode, so it's always
// clear that nothing is really saved online yet.
export function DemoBanner() {
  if (authMode !== "mock") return null;
  return (
    <div className="bg-accent-soft px-4 py-2 text-center text-xs text-muted">
      Demo mode: no Supabase keys yet, so your account is saved only in this browser.
    </div>
  );
}
