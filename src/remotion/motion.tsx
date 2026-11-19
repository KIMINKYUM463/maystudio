import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { BgmTrack, Style } from "../lib/types";
import { transitionFramesFor, type VideoProduct, type VideoScene } from "../lib/video/props";
import { FONT } from "./theme";

/** Frame each scene starts on, accounting for overlapping transitions. */
export function sceneStarts(scenes: VideoScene[], style: Style): number[] {
  const overlap = transitionFramesFor(style.template);
  const starts: number[] = [];
  let from = 0;
  scenes.forEach((s, i) => {
    starts.push(from);
    from += s.durationInFrames - (i < scenes.length - 1 ? overlap : 0);
  });
  return starts;
}

/** The generated loops differ in loudness; this evens them out so one volume slider fits all. */
// wings tracks measured RMS 0.13~0.15 (generated loops ~0.10~0.20), so they sit near 1.
const TRACK_GAIN: Record<Exclude<BgmTrack, "none">, number> = {
  calm: 0.7,
  bright: 1.25,
  lofi: 1.05,
  wings1: 1,
  wings2: 1,
  wings3: 0.92,
  wings4: 0.86,
  wings5: 0.9,
  wings6: 0.88,
};

/** Uploaded music wins; otherwise the chosen built-in loop. Music dips under the narration. */
export const MusicLayer: React.FC<{ style: Style; bgmSrc: string | null; scenes: VideoScene[] }> = ({ style, bgmSrc, scenes }) => {
  const src = bgmSrc ?? (style.bgmTrack !== "none" ? staticFile(`audio/bgm-${style.bgmTrack}.mp3`) : null);
  if (!src) return null;
  const gain = bgmSrc || style.bgmTrack === "none" ? 1 : TRACK_GAIN[style.bgmTrack];
  const voiced = scenes.some((s) => s.audioSrc);
  const volume = Math.min(1, style.bgmVolume * gain * (voiced ? 0.7 : 1));
  return <Audio src={src} volume={volume} loop />;
};

/** Whoosh into each scene (a beat before the cut), an impact on the hook, a ding on the last line. */
export const SoundEffects: React.FC<{ style: Style; scenes: VideoScene[] }> = ({ style, scenes }) => {
  if (!style.sfx || !scenes.length) return null;
  const starts = sceneStarts(scenes, style);
  const last = scenes.length - 1;
  return (
    <>
      {scenes.map((scene, i) => {
        const name = i === 0 ? "impact" : i === last ? "ding" : "whoosh";
        const lead = name === "whoosh" ? 6 : 0;
        const level = { impact: 0.55, whoosh: 0.35, ding: 0.4 }[name];
        return (
          <Sequence key={scene.id} from={Math.max(0, starts[i] - lead)} durationInFrames={45}>
            <Audio src={staticFile(`audio/sfx-${name}.mp3`)} volume={level * style.sfxVolume * 2} />
          </Sequence>
        );
      })}
    </>
  );
};

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0.75, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#fff", opacity }} />;
};

/** 📍 tag that springs in from the left during the hook and slides away before the next scene. */
const LocationTag: React.FC<{ region: string; accent: string; duration: number }> = ({ region, accent, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 160 } });
  const exit = interpolate(frame, [duration - 10, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(enter - exit, [0, 1], [-420, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top: 360,
        left: 56,
        transform: `translateX(${x}px)`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 30px 16px 22px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        fontFamily: FONT.sans,
        fontWeight: 800,
        fontSize: 40,
        color: "#111",
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 999, background: accent, boxShadow: `0 0 0 6px ${accent}33` }} />
      {region}
    </div>
  );
};

/** "저장 필수" sticker that pops and wiggles on the closing line. */
const SaveSticker: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 6, fps, config: { damping: 9, stiffness: 180 } });
  const wiggle = Math.sin(frame / 5) * 4;
  return (
    <div
      style={{
        position: "absolute",
        top: 360,
        right: 56,
        transform: `scale(${pop}) rotate(${-6 + wiggle}deg)`,
        padding: "18px 30px",
        borderRadius: 22,
        background: accent,
        color: "#fff",
        fontFamily: FONT.sans,
        fontWeight: 900,
        fontSize: 42,
        boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
      }}
    >
      🔖 저장 필수
    </div>
  );
};

const ProgressBar: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: "rgba(255,255,255,0.18)" }}>
      <div style={{ width: `${(frame / Math.max(1, durationInFrames - 1)) * 100}%`, height: "100%", background: accent }} />
    </div>
  );
};

/** Motion graphics drawn over the whole reel (style.motion). */
export const MotionLayer: React.FC<{ style: Style; scenes: VideoScene[]; product: VideoProduct }> = ({ style, scenes, product }) => {
  if (!style.motion || !scenes.length) return null;
  const starts = sceneStarts(scenes, style);
  const hook = scenes[0];
  const last = scenes.length - 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Sequence durationInFrames={8}>
        <Flash />
      </Sequence>
      {product.region ? (
        <Sequence durationInFrames={hook.durationInFrames}>
          <LocationTag region={product.region} accent={style.accentColor} duration={hook.durationInFrames} />
        </Sequence>
      ) : null}
      {last > 0 ? (
        <Sequence from={starts[last]} durationInFrames={scenes[last].durationInFrames}>
          <SaveSticker accent={style.accentColor} />
        </Sequence>
      ) : null}
      <ProgressBar accent={style.accentColor} />
    </AbsoluteFill>
  );
};
