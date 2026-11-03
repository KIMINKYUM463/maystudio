import type { TemplateId } from "../lib/types";

export const FONT = {
  sans: "Pretendard",
  display: "BlackHanSans",
  serif: "NanumMyeongjo",
} as const;

export type Theme = {
  label: string;
  description: string;
  captionFont: string;
  captionWeight: number;
  captionSize: { hook: number; feature: number };
  captionColor: string;
  /** Text outline drawn with paint-order stroke; 0 disables it. */
  strokeWidth: number;
  textShadow: string;
  letterSpacing: string;
  /** Full-frame gradient for legibility behind captions. */
  scrim: string;
  transition: "fade" | "slide" | "wipe" | "cut";
  /** How far (in scale units) the camera travels; bigger feels punchier. */
  cameraIntensity: number;
  highlightAccent: boolean;
  /** Set: the reel shows the narration as spoken subtitles instead of headline captions. */
  subtitles?: { font: string; size: number; centerY: number };
  /** "corner": a small "(광고)" top-right and a faint centred watermark, as on the benchmark channel. */
  overlay: "pill" | "corner";
};

export const THEMES: Record<TemplateId, Theme> = {
  review: {
    label: "1인칭 후기 (벤치마크)",
    description: "말하듯 끊기는 명조 자막 · 컷 편집 · 커버+캐러셀",
    captionFont: FONT.sans,
    captionWeight: 800,
    captionSize: { hook: 100, feature: 60 },
    captionColor: "#FFFFFF",
    strokeWidth: 0,
    textShadow: "0 0 10px rgba(0,0,0,0.5), 0 3px 14px rgba(0,0,0,0.45)",
    letterSpacing: "-0.02em",
    scrim: "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 20%)",
    transition: "cut",
    cameraIntensity: 0.08,
    highlightAccent: false,
    // Measured on the benchmark reels: white 명조, soft black glow, centred at ~42% of the height.
    subtitles: { font: FONT.serif, size: 66, centerY: 0.42 },
    overlay: "corner",
  },
  emotional: {
    label: "감성 스테이",
    description: "명조체 · 페이드 · 느린 카메라",
    captionFont: FONT.serif,
    captionWeight: 800,
    captionSize: { hook: 88, feature: 76 },
    captionColor: "#FFFFFF",
    strokeWidth: 0,
    textShadow: "0 4px 24px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.6)",
    letterSpacing: "-0.01em",
    scrim: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
    transition: "fade",
    cameraIntensity: 0.12,
    highlightAccent: false,
    overlay: "pill",
  },
  deal: {
    label: "가성비 특가",
    description: "굵은 고딕 · 외곽선 · 빠른 전환",
    captionFont: FONT.display,
    captionWeight: 400,
    captionSize: { hook: 104, feature: 92 },
    captionColor: "#FFFFFF",
    strokeWidth: 14,
    textShadow: "0 6px 0 rgba(0,0,0,0.35)",
    letterSpacing: "-0.02em",
    scrim: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.35) 100%)",
    transition: "slide",
    cameraIntensity: 0.2,
    highlightAccent: true,
    overlay: "pill",
  },
  luxury: {
    label: "럭셔리 호캉스",
    description: "얇은 고딕 · 골드 포인트 · 와이프",
    captionFont: FONT.sans,
    captionWeight: 600,
    captionSize: { hook: 84, feature: 72 },
    captionColor: "#F6EBD9",
    strokeWidth: 0,
    textShadow: "0 2px 18px rgba(0,0,0,0.7)",
    letterSpacing: "0.02em",
    scrim: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.75) 100%)",
    transition: "wipe",
    cameraIntensity: 0.1,
    highlightAccent: false,
    overlay: "pill",
  },
};
