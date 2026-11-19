import { z } from "zod";
import { DEFAULT_REPLICATE_MODEL } from "./replicate-models";

/** "review": first-person story reel benchmarked on @heo.jinny.gogo (spoken subtitles, hard cuts, cover + carousel). */
export const TEMPLATE_IDS = ["review", "emotional", "deal", "luxury"] as const;
/** Cover (thumbnail) designs; "auto" follows the video template. */
export const COVER_TEMPLATES = ["auto", "bold", "magazine", "card", "price", "frame", "split"] as const;
export const CAMERA_MOVES = [
  "push-in",
  "pull-out",
  "pan-left",
  "pan-right",
  "tilt-up",
  "tilt-down",
  "drift",
] as const;
/** Kit structure: hook → 소구점(feature) → 로망(romance) → 덤·여운(outro) → cta. "info" is legacy. */
export const SCENE_KINDS = ["hook", "feature", "romance", "outro", "info", "cta"] as const;
export const HOOK_ANGLES = [
  "condition",
  "contrast",
  "curiosity",
  "empathy",
  "numbers",
  "twist",
  "story",
  "tip",
  "price",
  // Market shopping-shorts structures added from the 2026-11 benchmark (see docs/research).
  "overseas",
  "urgency",
  "secret",
  "sensory",
  "target",
  "reverse",
] as const;
/** Hook angles from earlier versions, mapped to their closest current type. */
const LEGACY_HOOK_ANGLES: Record<string, (typeof HOOK_ANGLES)[number]> = {
  scarcity: "tip",
  emotion: "empathy",
  question: "curiosity",
  comparison: "contrast",
};
export const hookAngleSchema = z.preprocess(
  (value) => (typeof value === "string" ? (LEGACY_HOOK_ANGLES[value] ?? value) : value),
  z.enum(HOOK_ANGLES),
);
export const CATEGORIES = ["stay", "tour", "ticket", "package"] as const;
export const PLATFORMS = [
  "coupang",
  "myrealtrip",
  "agoda",
  "tripcom",
  "yeogi",
  "klook",
  "booking",
  "other",
] as const;
export const CAPTION_POSITIONS = ["top", "center", "bottom"] as const;
/** Spoken-subtitle looks measured on the benchmarks: "serif" = @heo.jinny.gogo, "bold" = 런비 lecture shorts. */
export const SUBTITLE_STYLES = ["serif", "bold"] as const;
export const TTS_PROVIDERS = ["none", "typecast", "gemini", "elevenlabs", "openai"] as const;
export const LLM_PROVIDERS = ["none", "openai", "anthropic", "gemini"] as const;
export const PROJECT_STATUSES = ["draft", "scripted", "rendering", "done", "error"] as const;
export const OPENAI_VOICES = ["nova", "shimmer", "coral", "alloy", "echo", "onyx", "sage"] as const;
/** ElevenLabs premade multilingual voice ("Rachel"); users can paste any voice id. */
export const ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
/** Korean voices picked for travel reels (Typecast ssfm-v30); the first is the default. */
export const TYPECAST_VOICES = [
  { id: "tc_692799c46508f6b9468c54c7", label: "다은 · 밝은 쇼츠 톤", name: "다은", tone: "밝고 경쾌한 쇼츠 톤", gender: "female" },
  { id: "tc_68785db8ba9cd7503f27d921", label: "고운 · 부드러운 톤", name: "고운", tone: "부드럽고 다정한 톤", gender: "female" },
  { id: "tc_6a7446c19f2d7dfed990a900", label: "은경 · 차분한 톤", name: "은경", tone: "차분한 라디오 톤", gender: "female" },
  { id: "tc_69f2e455ea79fd197aa0476f", label: "서현 · 또렷한 톤", name: "서현", tone: "또렷한 아나운서 톤", gender: "female" },
  { id: "tc_691d49ccc47926d741f15913", label: "효은 · 설명하는 톤", name: "효은", tone: "친절하게 설명하는 톤", gender: "female" },
  { id: "tc_68537c9420b646f2176890ba", label: "서진 · 대화하는 톤", name: "서진", tone: "친구랑 대화하듯", gender: "female" },
  { id: "tc_68413e12459cfdf27b481183", label: "라연 · 감성 톤", name: "라연", tone: "감성 브이로그 톤", gender: "female" },
  { id: "tc_67c90ad544cf859417f2fc3a", label: "예진 · 생기 톤", name: "예진", tone: "생기 있는 20대 톤", gender: "female" },
] as const;
/** Gemini prebuilt voices that read Korean naturally; the first is the default. */
export const GEMINI_VOICES = [
  { id: "Kore", label: "Kore · 또렷한 여성", name: "코어", tone: "또렷하고 단단한 여성", gender: "female" },
  { id: "Aoede", label: "Aoede · 산뜻한 여성", name: "에이드", tone: "산뜻하고 가벼운 여성", gender: "female" },
  { id: "Leda", label: "Leda · 어린 여성", name: "레다", tone: "어리고 발랄한 여성", gender: "female" },
  { id: "Zephyr", label: "Zephyr · 밝은 여성", name: "제퍼", tone: "밝고 시원한 여성", gender: "female" },
  { id: "Puck", label: "Puck · 경쾌한 남성", name: "퍽", tone: "경쾌한 남성", gender: "male" },
  { id: "Charon", label: "Charon · 차분한 남성", name: "카론", tone: "차분하고 깊은 남성", gender: "male" },
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type CoverTemplate = (typeof COVER_TEMPLATES)[number];
export type CameraMove = (typeof CAMERA_MOVES)[number];
export type SceneKind = (typeof SCENE_KINDS)[number];
export type HookAngle = (typeof HOOK_ANGLES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Platform = (typeof PLATFORMS)[number];
export type TtsProvider = (typeof TTS_PROVIDERS)[number];
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const productSchema = z.object({
  name: z.string().max(80).default(""),
  category: z.enum(CATEGORIES).default("stay"),
  region: z.string().max(40).default(""),
  priceText: z.string().max(40).default(""),
  originalPriceText: z.string().max(40).default(""),
  rating: z.string().max(10).default(""),
  features: z.array(z.string().max(60)).max(12).default([]),
  target: z.string().max(40).default(""),
  /** 숙소 유형 for contrast/twist hooks: 한옥, 펜션, 료칸… */
  stayType: z.string().max(20).default(""),
  /** Distance/time hook material: "서울에서 1시간". */
  access: z.string().max(40).default(""),
  /** The viewer's situation: "겨울 온천", "엄마 칠순 여행". */
  occasion: z.string().max(30).default(""),
  /** Script material from reviews and FAQs; only the AI rewrite reads it. */
  notes: z.string().max(2000).default(""),
  /** Only a stay the creator really visited may be written as a first-person review ("좋더라구요"). */
  visited: z.boolean().default(false),
  affiliateUrl: z.string().max(2000).default(""),
  sourceUrl: z.string().max(2000).default(""),
  platform: z.enum(PLATFORMS).default("other"),
});

export const MAX_ASSETS = 20;
export const MAX_SCENE_SHOTS = 6;

export const assetSchema = z.object({
  id: z.string(),
  file: z.string(),
  label: z.string().max(30).default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** AI image-to-video clip made from this photo; server-managed like audio files. */
  videoFile: z.string().optional(),
  /** In-flight Replicate prediction id; server-managed, never taken from PATCH. */
  animateJobId: z.string().optional(),
  /** AI photo group (water/signature/room/other); "other" (cars, signs, lobbies) stays out of the reel when possible. */
  group: z.enum(["water", "signature", "room", "other"]).optional(),
});

export const sceneSchema = z.object({
  id: z.string(),
  kind: z.enum(SCENE_KINDS),
  assetId: z.string().nullable(),
  /** More photos cut in quick succession after `assetId` (kit: 1~1.5s per shot). */
  extraAssetIds: z.array(z.string()).max(MAX_SCENE_SHOTS - 1).default([]),
  caption: z.string().max(60),
  subCaption: z.string().max(60).default(""),
  narration: z.string().max(200).default(""),
  camera: z.enum(CAMERA_MOVES).default("push-in"),
  durationSec: z.number().min(1).max(10).default(2.5),
  audioFile: z.string().optional(),
  audioDurationSec: z.number().optional(),
});

export const styleSchema = z.object({
  template: z.enum(TEMPLATE_IDS).default("emotional"),
  coverTemplate: z.enum(COVER_TEMPLATES).default("auto"),
  captionPosition: z.enum(CAPTION_POSITIONS).default("bottom"),
  subtitleStyle: z.enum(SUBTITLE_STYLES).default("serif"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#FF6B4A"),
  watermark: z.string().max(30).default(""),
  showAdLabel: z.boolean().default(true),
  showPriceBadge: z.boolean().default(true),
  /** Kit rule: keep the stay name out of the video and caption so viewers ask "여기 어디예요?". */
  showName: z.boolean().default(false),
  bgmFile: z.string().optional(),
  /** Channel logo drawn top-left on the reel, cover and carousel; server-managed like bgmFile. */
  logoFile: z.string().optional(),
  bgmVolume: z.number().min(0).max(1).default(0.25),
});

export const voiceSchema = z.object({
  provider: z.enum(TTS_PROVIDERS).default("none"),
  voiceId: z.string().max(60).default(""),
  speed: z.number().min(0.7).max(1.5).default(1.1),
});

export const copySchema = z.object({
  caption: z.string().max(2200).default(""),
  hashtags: z.array(z.string().max(40)).max(10).default([]),
  commentKeyword: z.string().max(10).default("숙소"),
  pinnedComment: z.string().max(300).default(""),
  dmTemplate: z.string().max(1000).default(""),
  /** Item number on the profile link page ("프로필링크 174번"); assigned once, kept by duplicates. */
  linkNumber: z.number().int().min(1).max(99_999).optional(),
});

/** Reels views are typed in by hand (Instagram has no API for this here); clicks come from /go. */
export const statsSchema = z.object({
  views: z.number().int().min(0).max(1_000_000_000).default(0),
});

export const renderStateSchema = z.object({
  status: z.enum(["idle", "queued", "bundling", "rendering", "done", "error"]),
  progress: z.number().min(0).max(1).default(0),
  outputFile: z.string().optional(),
  thumbnailFile: z.string().optional(),
  /** 4:5 carousel slides rendered alongside the reel. */
  carouselFiles: z.array(z.string()).default([]),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});

export const projectSchema = z.object({
  id: z.string(),
  title: z.string().max(80),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(PROJECT_STATUSES),
  hookAngle: hookAngleSchema.default("condition"),
  product: productSchema,
  assets: z.array(assetSchema).max(MAX_ASSETS),
  scenes: z.array(sceneSchema).max(16),
  style: styleSchema,
  voice: voiceSchema,
  copy: copySchema,
  render: renderStateSchema,
  stats: statsSchema.default({ views: 0 }),
});

/**
 * Like `.partial()` but strips `.default()` first. Zod's own `.partial()` still
 * fills defaults for missing keys, which would wipe stored values on PATCH.
 */
export function patchOf<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodType<Partial<z.output<z.ZodObject<T>>>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    const inner = field instanceof z.ZodDefault ? field.unwrap() : field;
    shape[key] = (inner as z.ZodType).optional();
  }
  return z.object(shape) as unknown as z.ZodType<Partial<z.output<z.ZodObject<T>>>>;
}

/** Fields a client is allowed to change via PATCH. */
export const projectPatchSchema = z.object({
  title: z.string().max(80).optional(),
  hookAngle: hookAngleSchema.optional(),
  product: patchOf(productSchema).optional(),
  assets: z
    .array(z.object({ id: z.string(), label: z.string().max(30).optional() }))
    .max(MAX_ASSETS)
    .optional(),
  scenes: z.array(sceneSchema).max(16).optional(),
  // Files are server-managed (upload routes) so clients cannot point them at arbitrary paths.
  style: patchOf(styleSchema.omit({ bgmFile: true, logoFile: true })).optional(),
  voice: patchOf(voiceSchema).optional(),
  copy: patchOf(copySchema.omit({ linkNumber: true })).optional(),
  stats: patchOf(statsSchema).optional(),
});

export const settingsSchema = z.object({
  llmProvider: z.enum(LLM_PROVIDERS).default("none"),
  openaiKey: z.string().default(""),
  openaiModel: z.string().default("gpt-5-mini"),
  anthropicKey: z.string().default(""),
  anthropicModel: z.string().default("claude-sonnet-4-5"),
  geminiKey: z.string().default(""),
  geminiModel: z.string().default("gemini-2.5-flash"),
  elevenlabsKey: z.string().default(""),
  typecastKey: z.string().default(""),
  /** Replicate token: turns still photos into clips (Wan / Kling), same role as Google Flow. */
  replicateKey: z.string().default(""),
  replicateModel: z.string().default(DEFAULT_REPLICATE_MODEL),
  instagramHandle: z.string().max(30).default(""),
  defaultCommentKeyword: z.string().max(10).default("숙소"),
  linkPageTitle: z.string().max(40).default("여행 숙소 큐레이션"),
  linkPageBio: z.string().max(120).default("영상 속 숙소 예약 링크를 모아뒀어요"),
  /** Last uploaded channel logo (DATA_DIR-relative); new projects start with a copy of it. */
  brandLogoFile: z.string().optional(),
  /** Reel collection (Meta Business Discovery): other channels' reel views for 오늘 터진 릴스. */
  metaToken: z.string().default(""),
  metaAppId: z.string().default(""),
  metaAppSecret: z.string().default(""),
  /** The user's own Instagram professional account id; found from the token on 연결 확인. */
  igUserId: z.string().default(""),
  /** Accounts to watch, one username per line. */
  reelAccounts: z.string().max(5000).default(""),
  reelIntervalHours: z.number().int().min(1).max(24).default(3),
  metaTokenRefreshedAt: z.string().default(""),
});

export type Product = z.infer<typeof productSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Style = z.infer<typeof styleSchema>;
export type Voice = z.infer<typeof voiceSchema>;
export type Copy = z.infer<typeof copySchema>;
export type RenderState = z.infer<typeof renderStateSchema>;
export type Stats = z.infer<typeof statsSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectPatch = z.infer<typeof projectPatchSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export const SECRET_SETTING_KEYS = [
  "openaiKey",
  "anthropicKey",
  "geminiKey",
  "elevenlabsKey",
  "typecastKey",
  "replicateKey",
  "metaToken",
  "metaAppSecret",
] as const satisfies readonly (keyof Settings)[];
