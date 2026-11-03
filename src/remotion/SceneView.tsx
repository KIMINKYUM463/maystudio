import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, useCurrentFrame } from "remotion";
import { timeChunks } from "../lib/script/subtitles";
import type { Style } from "../lib/types";
import type { VideoProduct, VideoScene } from "../lib/video/props";
import { Caption, Pill, PriceBadge, SAFE_BOTTOM, SAFE_TOP, SceneMedia, Subtitles, useEntrance } from "./components";
import { FONT, type Theme } from "./theme";

type SceneProps = {
  scene: VideoScene;
  style: Style;
  product: VideoProduct;
  theme: Theme;
};

const justifyFor: Record<Style["captionPosition"], React.CSSProperties["justifyContent"]> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

const TextScene: React.FC<SceneProps> = ({ scene, style, product, theme }) => {
  const isHook = scene.kind === "hook";
  const sub = useEntrance(8);
  return (
    <AbsoluteFill
      style={{
        padding: `${SAFE_TOP + 40}px 70px ${SAFE_BOTTOM}px`,
        justifyContent: justifyFor[style.captionPosition],
        alignItems: "center",
        gap: 36,
      }}
    >
      {isHook && style.captionPosition === "bottom" && style.showPriceBadge ? (
        <PriceBadge product={product} accent={style.accentColor} />
      ) : null}
      <Caption
        text={scene.caption}
        theme={theme}
        size={isHook ? theme.captionSize.hook : theme.captionSize.feature}
        accent={style.accentColor}
      />
      {scene.subCaption ? (
        <div style={{ opacity: sub.opacity, transform: `translateY(${sub.translateY}px)` }}>
          <Pill background="rgba(0,0,0,0.42)" size={isHook ? 38 : 32}>
            {scene.subCaption}
          </Pill>
        </div>
      ) : null}
      {isHook && style.captionPosition !== "bottom" && style.showPriceBadge ? (
        <PriceBadge product={product} accent={style.accentColor} />
      ) : null}
    </AbsoluteFill>
  );
};

const InfoScene: React.FC<SceneProps> = ({ scene, style, product, theme }) => {
  const card = useEntrance(0);
  const chips = product.features.slice(0, 3);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 64px" }}>
      <div
        style={{
          opacity: card.opacity,
          transform: `translateY(${card.translateY}px)`,
          width: "100%",
          borderRadius: 48,
          padding: "64px 56px",
          background: "rgba(12,14,24,0.62)",
          backdropFilter: "blur(18px)",
          border: "1.5px solid rgba(255,255,255,0.18)",
          color: "#fff",
          fontFamily: FONT.sans,
          display: "flex",
          flexDirection: "column",
          gap: 26,
          boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
        }}
      >
        {product.region ? (
          <div style={{ fontSize: 36, fontWeight: 600, opacity: 0.8 }}>📍 {product.region}</div>
        ) : null}
        <div
          style={{
            fontFamily: theme.captionFont,
            fontWeight: theme.captionWeight,
            fontSize: 70,
            lineHeight: 1.18,
            wordBreak: "keep-all",
          }}
        >
          {scene.caption}
        </div>
        {product.priceText ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 68, fontWeight: 900, color: style.accentColor, letterSpacing: "-0.03em" }}>
              {product.priceText}
            </span>
            {product.originalPriceText ? (
              <span style={{ fontSize: 36, opacity: 0.6, textDecoration: "line-through" }}>
                {product.originalPriceText}
              </span>
            ) : null}
          </div>
        ) : null}
        {product.rating ? <div style={{ fontSize: 40, fontWeight: 700 }}>⭐ {product.rating}</div> : null}
        {chips.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {chips.map((chip) => (
              <span
                key={chip}
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  padding: "12px 24px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.14)",
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const CtaScene: React.FC<SceneProps> = ({ scene, style, theme }) => {
  const frame = useCurrentFrame();
  const bubble = useEntrance(4, true);
  const bob = Math.sin(frame / 6) * 10;
  const keywordMatch = scene.caption.match(/'([^']+)'/);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: 44,
        padding: `0 64px ${SAFE_BOTTOM / 2}px`,
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          opacity: bubble.opacity,
          transform: `scale(${bubble.scale}) translateY(${bob}px)`,
          fontSize: 150,
          lineHeight: 1,
        }}
      >
        💬
      </div>
      <Caption text={scene.caption} theme={theme} size={theme.captionSize.feature + 6} accent={style.accentColor} />
      {keywordMatch ? (
        <div
          style={{
            opacity: bubble.opacity,
            padding: "22px 54px",
            borderRadius: 24,
            background: style.accentColor,
            color: "#fff",
            fontFamily: FONT.sans,
            fontWeight: 900,
            fontSize: 64,
            boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
          }}
        >
          댓글: {keywordMatch[1]}
        </div>
      ) : null}
      {scene.subCaption ? (
        <div style={{ fontFamily: FONT.sans, fontSize: 34, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
          {scene.subCaption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const SubtitleScene: React.FC<SceneProps> = ({ scene, theme }) => {
  const chunks = useMemo(
    () => timeChunks(scene.narration || scene.caption.replace(/\n/g, " "), scene.durationInFrames),
    [scene.narration, scene.caption, scene.durationInFrames],
  );
  if (!theme.subtitles) return null;
  return <Subtitles chunks={chunks} {...theme.subtitles} />;
};

/**
 * Two independent stacks per scene:
 * 1) Footage — Replicate/Flow clip, or a still with Ken Burns
 * 2) Motion graphics — scrim + captions/subtitles/badges (always drawn on top of footage)
 * Global logo / (광고) / watermark sit above the whole series in TravelShort.
 */
export const SceneView: React.FC<SceneProps> = (props) => {
  const { scene, style, theme } = props;
  const frame = useCurrentFrame();
  const scrimOpacity = interpolate(frame, [0, 12], [0.6, 1], { extrapolateRight: "clamp" });
  const Graphics = theme.subtitles
    ? SubtitleScene
    : scene.kind === "info"
      ? InfoScene
      : scene.kind === "cta"
        ? CtaScene
        : TextScene;
  return (
    <AbsoluteFill>
      <SceneMedia
        shots={scene.shots}
        camera={scene.camera}
        intensity={theme.cameraIntensity}
        accent={style.accentColor}
        durationInFrames={scene.durationInFrames}
      />
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <AbsoluteFill style={{ background: theme.scrim, opacity: scrimOpacity }} />
        <Graphics {...props} />
      </AbsoluteFill>
      {scene.audioSrc ? <Audio src={scene.audioSrc} /> : null}
    </AbsoluteFill>
  );
};
