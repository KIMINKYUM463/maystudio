"use client";

import { useEffect, useState } from "react";
import { api, projectFileUrl } from "@/lib/client/api";
import showcase from "@/lib/data/showcase.json";
import type { LookbookPhoto } from "@/lib/server/lookbook";

type StripPhoto = { src: string; label: string };
/** Bundled sample photos (public/showcase) so a fresh install or the hosted site never shows an empty strip. */
const SHOWCASE = showcase as StripPhoto[];

/** Slow, endless strip of the user's own stay photos (deduplicated server-side), shown like a hotel lookbook. */
export function PhotoMarquee({ refreshKey }: { refreshKey: number }) {
  const [own, setOwn] = useState<LookbookPhoto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ photos: LookbookPhoto[] }>("/api/lookbook")
      .then(({ photos }) => !cancelled && setOwn(photos))
      .catch(() => !cancelled && setOwn([]));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!own) return null;
  const photos: StripPhoto[] =
    own.length >= 4 ? own.map((p) => ({ src: projectFileUrl(p.projectId, p.file), label: p.label })) : SHOWCASE;
  // Rendered twice so the -50% translate loops seamlessly.
  const loop = [...photos, ...photos];
  return (
    <div aria-hidden className="marquee-mask relative mt-14 overflow-hidden">
      {/* ~6s per photo keeps the drift calm (~30px/s) however many photos there are. */}
      <div className="marquee-track flex w-max gap-4" style={{ animationDuration: `${photos.length * 6}s` }}>
        {loop.map((photo, i) => (
          <figure
            key={`${photo.src}-${i}`}
            className="relative h-56 w-40 shrink-0 overflow-hidden rounded-2xl bg-surface-3 shadow-[var(--shadow-card)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user media served by our own API or public/showcase */}
            <img src={photo.src} alt="" loading="lazy" className="size-full object-cover" />
            <figcaption className="absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-fg backdrop-blur-sm">
              {photo.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
