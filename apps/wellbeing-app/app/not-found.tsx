import Link from "next/link";
import { link } from "@/components/ui";

// Shown for any URL that doesn't match a page.
export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/" className={`mt-6 inline-block ${link}`}>
        Back home
      </Link>
    </div>
  );
}
