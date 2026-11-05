import type { NextConfig } from "next";

// Next.js settings.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The service worker file must never be cached by the browser's normal
        // HTTP cache. Otherwise a phone could keep running an old version for
        // up to 24 hours after we publish a fix.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // The service worker may only load scripts from our own site.
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
