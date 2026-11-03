import React from "react";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedChunk } from "../lib/script/subtitles";
import type { CameraMove, Style } from "../lib/types";
import type { VideoProduct, VideoShot } from "../lib/video/props";
import { cameraTransform } from "./camera";
import { FONT, type Theme } from "./theme";

/** Instagram Reels overlays its UI here; keep text out of these bands. */
export const SAFE_TOP = 230;
export const SAFE_BOTTOM = 430;

export const CameraImage: React.FC<{
  src: string | null;
  camera: CameraMove;
  intensity: number;
  accent: string;
  durationInFrames: number;
}> = ({ src, camera, intensity, accent, durationInFrames }) => {
  const frame = useCurrentFrame();
  if (!src) {
    return (
      <AbsoluteFill
        style={{ background: `radial-gradient(circle at 30% 20%, ${accent} 0%, #1B2140 55%, #0B0E1C 100%)` }}
      />
    );
  }
  const { scale, x, y } = cameraTransform(camera, frame / Math.max(1, durationInFrames - 1), intensity);
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <Img
        src={src}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.7)",
          transform: "scale(1.25)",
        }}
      />
      <Img
        src={src}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
          willChange: "transform",
        }}
      />
    </AbsoluteFill>
  );
};

/** Each quick cut moves differently so a run of photos doesn't feel like a slideshow. */
const CUT_CAMERAS: CameraMove[] = ["push-in", "pan-right", "pull-out", "pan-left", "drift", "tilt-up"];

type MediaProps = { camera: CameraMove; intensity: number; accent: string; durationInFrames: number };

/**
 * Footage only (layer 1). Replicate/Flow mp4 plays as the cut; without a clip the still
 * gets Ken Burns. Captions, badges, logo — motion graphics — live in SceneView above this
 * and are never turned off just because a clip exists.
 */
const Shot: React.FC<MediaProps & { shot: VideoShot }> = ({ shot, ...media }) => (
  <AbsoluteFill>
    <CameraImage src={shot.imageSrc} {...media} intensity={shot.videoSrc ? 0 : media.intensity} />
    {shot.videoSrc ? (
      <OffthreadVideo
        src={shot.videoSrc}
        muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    ) : null}
  </AbsoluteFill>
);

/** Splits a scene evenly across its shots (kit: cut every 1~1.5s under one narration line). */
export const SceneMedia: React.FC<MediaProps & { shots: VideoShot[] }> = ({ shots, camera, durationInFrames, ...rest }) => {
  if (shots.length === 0) return <CameraImage src={null} camera={camera} durationInFrames={durationInFrames} {...rest} />;
  const per = Math.max(1, Math.floor(durationInFrames / shots.length));
  const start = Math.max(0, CUT_CAMERAS.indexOf(camera));
  return (
    <>
      {shots.map((shot, i) => {
        const from = i * per;
        const length = i === shots.length - 1 ? durationInFrames - from : per;
        return (
          <Sequence key={i} from={from} durationInFrames={length}>
            <Shot
              shot={shot}
              camera={i === 0 ? camera : CUT_CAMERAS[(start + i) % CUT_CAMERAS.length]}
              durationInFrames={length}
              {...rest}
            />
          </Sequence>
        );
      })}
    </>
  );
};

export function useEntrance(delay = 0, bouncy = false): { opacity: number; translateY: number; scale: number } {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: bouncy ? { damping: 11, stiffness: 160, mass: 0.7 } : { damping: 200 },
    durationInFrames: bouncy ? undefined : 18,
  });
  return {
    opacity: interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
    translateY: interpolate(s, [0, 1], [48, 0]),
    scale: bouncy ? interpolate(s, [0, 1], [0.7, 1]) : 1,
  };
}

const STATIC_ENTRANCE = { opacity: 1, translateY: 0, scale: 1 };

export const Caption: React.FC<{
  text: string;
  theme: Theme;
  size: number;
  accent: string;
  animate?: boolean;
  delay?: number;
}> = ({ text, theme, size, accent, animate = true, delay = 0 }) => {
  const animated = useEntrance(delay, theme.highlightAccent);
  const { opacity, translateY, scale } = animate ? animated : STATIC_ENTRANCE;
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        fontFamily: theme.captionFont,
        fontWeight: theme.captionWeight,
        fontSize: size,
        lineHeight: 1.22,
        letterSpacing: theme.letterSpacing,
        color: theme.captionColor,
        textAlign: "center",
        textShadow: theme.textShadow,
        wordBreak: "keep-all",
        overflowWrap: "break-word",
      }}
    >
      {lines.map((line, i) => {
        const highlight = theme.highlightAccent && lines.length > 1 && i === lines.length - 1;
        return (
          <div
            key={i}
            style={{
              color: highlight ? accent : undefined,
              WebkitTextStroke: theme.strokeWidth ? `${theme.strokeWidth}px #111` : undefined,
              paintOrder: "stroke fill",
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

export const Pill: React.FC<{ children: React.ReactNode; background: string; color?: string; size?: number }> = ({
  children,
  background,
  color = "#fff",
  size = 36,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: `${size * 0.35}px ${size * 0.8}px`,
      borderRadius: 999,
      background,
      color,
      fontFamily: FONT.sans,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: "-0.01em",
      boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

export const PriceBadge: React.FC<{ product: VideoProduct; accent: string; animate?: boolean }> = ({
  product,
  accent,
  animate = true,
}) => {
  const animated = useEntrance(10, true);
  const { opacity, scale } = animate ? animated : STATIC_ENTRANCE;
  if (!product.priceText) return null;
  return (
    <div
      style={{
        opacity,
        transform: `rotate(-6deg) scale(${scale})`,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "22px 40px",
        borderRadius: 28,
        background: accent,
        color: "#fff",
        fontFamily: FONT.sans,
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
      }}
    >
      {product.originalPriceText ? (
        <div style={{ fontSize: 34, fontWeight: 600, opacity: 0.85, textDecoration: "line-through" }}>
          {product.originalPriceText}
        </div>
      ) : null}
      <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: "-0.03em" }}>{product.priceText}</div>
    </div>
  );
};

const SOFT_SHADOW = "0 1px 6px rgba(0,0,0,0.55)";

export const Logo: React.FC<{ src: string | null; height?: number; top?: number; left?: number; right?: number }> = ({
  src,
  height = 140,
  top = 70,
  left,
  right,
}) =>
  src ? (
    <Img
      src={src}
      style={{
        position: "absolute",
        top,
        left: left ?? (right === undefined ? 48 : undefined),
        right,
        height,
        width: "auto",
        filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.35))",
      }}
    />
  ) : null;

/** Benchmark-style small "(광고)" in the top-right corner. */
export const CornerAdLabel: React.FC<{ top?: number; size?: number }> = ({ top = 86, size = 30 }) => (
  <div
    style={{
      position: "absolute",
      top,
      right: 50,
      fontFamily: FONT.sans,
      fontWeight: 600,
      fontSize: size,
      color: "rgba(255,255,255,0.88)",
      textShadow: SOFT_SHADOW,
    }}
  >
    (광고)
  </div>
);

/** One spoken phrase at a time, hard-switched like the benchmark (no entrance animation). */
export const Subtitles: React.FC<{ chunks: TimedChunk[]; font: string; size: number; centerY: number }> = ({
  chunks,
  font,
  size,
  centerY,
}) => {
  const frame = useCurrentFrame();
  const current = chunks.find((c) => frame >= c.from && frame < c.from + c.durationInFrames);
  if (!current) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: `${centerY * 100}%`,
          transform: "translateY(-50%)",
          padding: "0 60px",
          fontFamily: font,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.25,
          color: "#fff",
          textAlign: "center",
          wordBreak: "keep-all",
          textShadow: "0 0 10px rgba(0,0,0,0.85), 0 0 24px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.9)",
        }}
      >
        {current.text}
      </div>
    </AbsoluteFill>
  );
};

export const Overlay: React.FC<{ style: Style; theme: Theme; logoSrc: string | null }> = ({ style, theme, logoSrc }) =>
  theme.overlay === "corner" ? (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Logo src={logoSrc} />
      {style.showAdLabel ? <CornerAdLabel /> : null}
      {style.watermark ? (
        <div
          style={{
            position: "absolute",
            top: "58%",
            width: "100%",
            textAlign: "center",
            fontFamily: FONT.sans,
            fontWeight: 600,
            fontSize: 40,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          {style.watermark}
        </div>
      ) : null}
    </AbsoluteFill>
  ) : (
    <PillOverlay style={style} logoSrc={logoSrc} />
  );

const PillOverlay: React.FC<{ style: Style; logoSrc: string | null }> = ({ style, logoSrc }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <Logo src={logoSrc} height={110} top={110} right={56} />
    {style.showAdLabel ? (
      <div style={{ position: "absolute", top: 120, left: 56 }}>
        <Pill background="rgba(0,0,0,0.45)" size={30}>
          광고 · 제휴링크 포함
        </Pill>
      </div>
    ) : null}
    {style.watermark ? (
      <div
        style={{
          position: "absolute",
          right: 56,
          bottom: SAFE_BOTTOM - 70,
          fontFamily: FONT.sans,
          fontWeight: 700,
          fontSize: 34,
          color: "rgba(255,255,255,0.75)",
          textShadow: "0 2px 10px rgba(0,0,0,0.6)",
        }}
      >
        {style.watermark}
      </div>
    ) : null}
  </AbsoluteFill>
);
