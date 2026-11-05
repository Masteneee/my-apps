"use client";
// A movie poster, with a fallback box showing the title when there is no
// poster or the image fails to load (bad link, offline...).

import { useState } from "react";

type Props = { src: string | null; title: string; className?: string };

export function Poster({ src, title, className = "" }: Props) {
  // We remember WHICH address failed, so if `src` changes to a new address
  // we try again instead of showing the fallback forever.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showFallback = !src || failedSrc === src;

  // aspect-2/3 = posters are 2 wide for 3 tall, so the grid stays even.
  const box = `aspect-2/3 w-full overflow-hidden rounded-md bg-zinc-800 ${className}`;

  if (showFallback) {
    return (
      <div className={`${box} flex items-center justify-center p-2 text-center text-xs text-zinc-400`}>{title}</div>
    );
  }

  return (
    // We use a plain <img> instead of Next.js's <Image> for now: <Image> needs
    // extra config for outside image hosts and resizes images through the
    // server. Stage 7 (performance pass) is the place to switch.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Poster of ${title}`}
      loading="lazy" // only download posters when they scroll into view
      onError={() => setFailedSrc(src)}
      className={`${box} object-cover`}
    />
  );
}
