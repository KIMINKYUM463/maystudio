"use client";

import { useEffect, useState } from "react";

/** Hard-cut demo frames: atmosphere only (no stock photos dependency). */
const SCENES = [
  {
    label: "오션뷰",
    wash: "radial-gradient(ellipse at 30% 20%, #5eb8ff 0%, transparent 45%), linear-gradient(160deg, #1a3a55 0%, #0c1824 55%, #061018 100%)",
    chunks: ["사우나를", "내 방처럼", "쓸 수 있는", "숙소가 있어요"],
  },
  {
    label: "야경",
    wash: "radial-gradient(ellipse at 70% 30%, #ff8a4a 0%, transparent 40%), linear-gradient(200deg, #2a1840 0%, #120c1c 50%, #08060e 100%)",
    chunks: ["불 꺼진 뒤에야", "진짜로", "쉬기 시작해요"],
  },
  {
    label: "온천",
    wash: "radial-gradient(ellipse at 50% 80%, #ffe0b8 0%, transparent 50%), linear-gradient(180deg, #3d2a22 0%, #1a120e 60%, #0a0705 100%)",
    chunks: ["물이", "김을 내며", "천천히", "출렁여요"],
  },
] as const;

const CUT_MS = 1400;
const CHUNK_MS = 700;

/**
 * Mini 9:16 reel for the home hero: hard cuts + chunked 명조 subtitles —
 * the same two layers the export uses (footage under, motion graphics over).
 * Called only from Dashboard.tsx; no other home-hero reel exists.
 */
export function HeroReel() {
  const [mounted, setMounted] = useState(false);
  const [scene, setScene] = useState(0);
  const [chunk, setChunk] = useState(0);

  // Animate only after mount so SSR HTML and the first client paint stay identical.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setScene((s) => (s + 1) % SCENES.length);
      setChunk(0);
    }, CUT_MS);
    return () => window.clearInterval(id);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setChunk((c) => (c + 1) % SCENES[scene].chunks.length);
    }, CHUNK_MS);
    return () => window.clearInterval(id);
  }, [mounted, scene]);

  const current = SCENES[scene];

  return (
    <div className="hero-reel relative mx-auto w-[min(100%,280px)]" aria-hidden>
      <div className="hero-reel-glow absolute -inset-8 rounded-[40%] opacity-70" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-black shadow-[0_40px_80px_-20px_rgba(0,0,0,0.85)] ring-1 ring-white/10">
        <div className="absolute top-3 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black/80" />
        <div className="relative aspect-[9/16] overflow-hidden">
          {SCENES.map((s, i) => (
            <div
              key={s.label}
              className="hero-reel-cut absolute inset-0"
              style={{
                background: s.wash,
                opacity: i === scene ? 1 : 0,
                zIndex: i === scene ? 1 : 0,
              }}
            >
              {i === scene ? (
                <div key={scene} className="hero-reel-ken absolute inset-[-8%]" style={{ background: s.wash }} />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/50" />
            </div>
          ))}
          <div className="absolute top-10 left-4 z-10 rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/90">
            (광고)
          </div>
          <div className="absolute inset-x-0 top-[40%] z-10 px-5 text-center">
            <p
              key={`${scene}-${chunk}`}
              className="hero-reel-sub text-[1.35rem] leading-snug font-extrabold text-white"
              style={{ fontFamily: "NanumMyeongjo, Georgia, serif", textShadow: "0 0 12px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.9)" }}
            >
              {current.chunks[chunk]}
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-5 z-10 flex flex-col items-center gap-1.5">
            <div className="flex gap-1">
              {SCENES.map((_, i) => (
                <span
                  key={i}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: i === scene ? 18 : 6,
                    background: i === scene ? "#ff6b4a" : "rgba(255,255,255,0.35)",
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] font-medium tracking-wide text-white/55">{current.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
