import type { NextConfig } from "next";
import { COVER_HOSTS } from "./lib/media/covers";

// Next.js settings.
const nextConfig: NextConfig = {
  images: {
    // Stage 7: <Image> (next/image) may resize and convert covers from these
    // hosts only. Any other address gets "400 Bad Request" from /_next/image, so
    // nobody can use our server to resize their own pictures. The host list
    // lives in lib/media/covers.ts, shared with the Poster component.
    remotePatterns: COVER_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
    // Covers of a given item never change, so the resized copy can be kept a
    // long time (30 days, in seconds) instead of the default 4 hours. Fewer
    // re-downloads = faster pages and fewer "image optimizations" counted by Vercel.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
