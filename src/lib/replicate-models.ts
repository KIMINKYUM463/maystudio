/** Replicate official image-to-video models used instead of a manual Google Flow export. */
export const DEFAULT_REPLICATE_MODEL = "wan-video/wan-2.2-i2v-fast";

export const REPLICATE_I2V_MODELS = [
  {
    id: "wan-video/wan-2.2-i2v-fast",
    label: "Wan 2.2 Fast",
    hint: "싸고 빠름 · 약 5초 · 숙소 사진 움직임용 기본값",
  },
  {
    id: "bytedance/seedance-1-lite",
    label: "Seedance 1 Lite",
    hint: "중간 화질 · 5초 · 720p",
  },
  {
    id: "kwaivgi/kling-v2.5-turbo-pro",
    label: "Kling 2.5 Turbo",
    hint: "고화질 · 5초 · Flow에 가까운 움직임 (비쌈)",
  },
] as const;

export type ReplicateModelId = (typeof REPLICATE_I2V_MODELS)[number]["id"];

/**
 * Rough price of one ~5s clip at the settings the app sends (Wan: 480p default). Shown before a batch.
 * Wan 2.2 Fast i2v 480p = $0.05 per video (replicate.com/blog/wan-22, 2025); Seedance/Kling are estimates.
 * shortcut: fixed table, check replicate.com model pages when prices change.
 */
export const CLIP_COST_USD: Record<string, number> = {
  "wan-video/wan-2.2-i2v-fast": 0.05,
  "bytedance/seedance-1-lite": 0.18,
  "kwaivgi/kling-v2.5-turbo-pro": 0.35,
};
export const KRW_PER_USD = 1400;
/** google/nano-banana season image, per image (replicate.com/google/nano-banana). */
export const SEASON_IMAGE_COST_USD = 0.039;
