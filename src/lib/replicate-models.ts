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
