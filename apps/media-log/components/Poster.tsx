"use client";
// A cover (movie poster, book cover...), with a fallback box showing the title
// when there is no cover or the image fails to load (bad link, offline...).
//
// Stage 7: uses <Image> from next/image instead of a plain <img>. For covers from
// our 4 sources (lib/media/covers.ts), Next.js then:
// - sends a version sized for THIS spot on the page (the `sizes` prop below), in
//   WebP/AVIF when the browser supports it: smaller downloads;
// - caches that version on our server (next.config.ts, minimumCacheTTL);
// - lazy-loads it (only downloads when it scrolls into view).

import Image from "next/image";
import { useState } from "react";
import { isOptimizableCover } from "@/lib/media/covers";

type Props = {
  src: string | null;
  title: string;
  className?: string;
  /**
   * How wide the cover shows on screen, so the browser picks the right file.
   * "64px" = always 64 pixels wide. The default fits the poster grids:
   * 6 per row on wide screens (about 160px), 3 per row on phones (a third of the screen).
   */
  sizes?: string;
  /** True for the one big cover at the top of a page: load it right away, not lazily. */
  eager?: boolean;
};

export const GRID_SIZES = "(min-width: 768px) 160px, 33vw";

export function Poster({ src, title, className = "", sizes = GRID_SIZES, eager = false }: Props) {
  // We remember WHICH address failed, so if `src` changes to a new address
  // we try again instead of showing the fallback forever.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showFallback = !src || failedSrc === src;

  // aspect-2/3 = posters are 2 wide for 3 tall, so the grid stays even.
  // `relative` because <Image fill> stretches to fill the nearest positioned box.
  const box = `relative aspect-2/3 w-full overflow-hidden rounded-md bg-zinc-800 ${className}`;

  if (showFallback) {
    return (
      <div className={`${box} flex items-center justify-center p-2 text-center text-xs text-zinc-400`}>{title}</div>
    );
  }

  return (
    <div className={box}>
      <Image
        src={src}
        alt={`Poster of ${title}`}
        // `fill` = take the size of the box above. We don't know each cover's
        // real width/height, and the box already fixes the 2:3 shape, so the
        // page doesn't jump when the image arrives.
        fill
        sizes={sizes}
        // A cover from another host (anyone can save any https address) is shown
        // as-is: Next.js would refuse to optimize it (see next.config.ts).
        unoptimized={!isOptimizableCover(src)}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        onError={() => setFailedSrc(src)}
        className="object-cover"
      />
    </div>
  );
}
