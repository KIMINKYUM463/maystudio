"use client";

import { useMemo, useState } from "react";
import { cx } from "@/components/ui";
import { timeChunks } from "@/lib/script/subtitles";
import { FPS, transitionFramesFor, videoDurationInFrames, type VideoProps } from "@/lib/video/props";

const BASE_PX_PER_SEC = 64;
const TRACK_LABEL_W = 56;

/** Deterministic pseudo-waveform so the sound track reads as audio without decoding files. */
function waveBars(seed: string, count: number): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: count }, (_, i) => {
    h = Math.imul(h ^ (i + 1), 16777619);
    return 0.3 + ((h >>> 0) % 70) / 100;
  });
}

type Block = { key: string; from: number; frames: number };

/**
 * Editor timeline: 자막 / 영상 / 소리 tracks laid out on real frame times (scene starts account for
 * transition overlap), a ruler, a playhead that follows the player, and click-to-seek.
 */
export function Timeline({
  props,
  currentFrame,
  onSeek,
  activeScene,
}: {
  props: VideoProps;
  currentFrame: number;
  onSeek: (frame: number) => void;
  activeScene: string | null;
}) {
  const [zoom, setZoom] = useState(1);
  const pxPerFrame = (BASE_PX_PER_SEC * zoom) / FPS;
  const total = videoDurationInFrames(props);
  const overlap = transitionFramesFor(props.style.template);

  const layout = useMemo(() => {
    const scenes = [];
    for (let i = 0, from = 0; i < props.scenes.length; i++) {
      const scene = props.scenes[i];
      const shotFrames = scene.durationInFrames / Math.max(1, scene.shots.length);
      const shots: (Block & { src: string })[] = scene.shots.map((shot, k) => ({
        key: `${scene.id}-${k}`,
        from: from + k * shotFrames,
        frames: shotFrames,
        src: shot.imageSrc,
      }));
      const chunks: (Block & { text: string })[] = timeChunks(
        scene.narration || scene.caption.replace(/\n/g, " "),
        scene.durationInFrames,
        props.style.subtitleStyle === "bold" ? 6 : undefined,
      ).map((c, k) => ({ key: `${scene.id}-c${k}`, from: from + c.from, frames: c.durationInFrames, text: c.text }));
      scenes.push({ scene, from, frames: scene.durationInFrames, shots, chunks });
      from += scene.durationInFrames - (i < props.scenes.length - 1 ? overlap : 0);
    }
    return scenes;
  }, [props, overlap]);

  const width = total * pxPerFrame;
  const seconds = Math.ceil(total / FPS);
  const step = zoom < 0.8 ? 2 : 1;

  function seekFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frame = Math.round((e.clientX - rect.left) / pxPerFrame);
    onSeek(Math.max(0, Math.min(total - 1, frame)));
  }

  const row = "relative h-11";
  return (
    <section aria-label="타임라인" className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-sm font-bold">
          타임라인
          <span className="tabular ml-2 text-xs font-semibold text-muted">
            {props.scenes.length}개 장면 · {(total / FPS).toFixed(1)}초
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="축소" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="flex size-7 items-center justify-center rounded-full border border-line text-muted hover:text-fg">
            −
          </button>
          <span className="tabular w-12 text-center text-xs font-semibold text-muted">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="확대" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="flex size-7 items-center justify-center rounded-full border border-line text-muted hover:text-fg">
            +
          </button>
        </div>
      </div>
      <div className="flex">
        <div className="shrink-0 border-r border-line pt-6 text-[11px] font-bold text-muted" style={{ width: TRACK_LABEL_W }}>
          {["자막", "영상", "소리"].map((t) => (
            <div key={t} className="flex h-11 items-center justify-center">
              {t}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative cursor-pointer select-none" style={{ width: Math.max(width + 24, 100) }} onClick={seekFromEvent}>
            {/* Ruler */}
            <div className="relative h-6 border-b border-line">
              {Array.from({ length: Math.floor(seconds / step) + 1 }, (_, i) => i * step).map((s) => (
                <span key={s} className="tabular absolute top-1 text-[10px] text-faint" style={{ left: s * FPS * pxPerFrame }}>
                  <span className="absolute -top-1 left-0 h-2 w-px bg-line" />
                  <span className="ml-1">0:{String(s).padStart(2, "0")}</span>
                </span>
              ))}
            </div>
            {/* 자막 */}
            <div className={row}>
              {layout.flatMap((s) =>
                s.chunks.map((c) => (
                  <div
                    key={c.key}
                    title={c.text}
                    className={cx(
                      "absolute top-1.5 flex h-8 items-center overflow-hidden rounded-md border px-1.5 text-[11px] font-semibold whitespace-nowrap",
                      currentFrame >= c.from && currentFrame < c.from + c.frames
                        ? "border-accent bg-accent text-white"
                        : activeScene === s.scene.id
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-line bg-surface-2 text-fg",
                    )}
                    style={{ left: c.from * pxPerFrame, width: Math.max(2, c.frames * pxPerFrame - 2) }}
                  >
                    {c.text}
                  </div>
                )),
              )}
            </div>
            {/* 영상 */}
            <div className={row}>
              {layout.flatMap((s) =>
                s.shots.map((shot) => (
                  <div
                    key={shot.key}
                    className={cx(
                      "absolute top-1 h-9 overflow-hidden rounded-md border-2 bg-surface-3 bg-cover bg-center",
                      activeScene === s.scene.id ? "border-accent" : "border-white",
                    )}
                    style={{ left: shot.from * pxPerFrame, width: Math.max(2, shot.frames * pxPerFrame - 2), backgroundImage: `url(${shot.src})` }}
                  />
                )),
              )}
            </div>
            {/* 소리 */}
            <div className={row}>
              {layout.map((s) =>
                s.scene.audioSrc ? (
                  <div
                    key={s.scene.id}
                    className="absolute top-1.5 flex h-8 items-center gap-[2px] overflow-hidden rounded-md border border-accent/30 bg-accent/[0.06] px-1"
                    style={{ left: s.from * pxPerFrame, width: Math.max(2, s.frames * pxPerFrame - 2) }}
                  >
                    {waveBars(s.scene.id, Math.max(4, Math.floor((s.frames * pxPerFrame) / 4))).map((h, i) => (
                      <span key={i} className="w-[2px] shrink-0 rounded-full bg-accent/70" style={{ height: `${h * 100}%` }} />
                    ))}
                  </div>
                ) : null,
              )}
            </div>
            {/* Playhead */}
            <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-accent" style={{ left: currentFrame * pxPerFrame }}>
              <span className="absolute -top-0.5 -left-1 size-2.5 rounded-full bg-accent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
