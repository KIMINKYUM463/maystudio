import {
  copySchema,
  productSchema,
  projectSchema,
  styleSchema,
  voiceSchema,
  type Project,
  type Settings,
  type TtsProvider,
  GEMINI_VOICES,
  TYPECAST_VOICES,
} from "./types";

/** Benchmark reels always carry narration: default to the first voice provider that has a key. */
function defaultVoice(defaults: Partial<Settings>) {
  const order: Array<[TtsProvider, string | undefined, string]> = [
    ["typecast", defaults.typecastKey, TYPECAST_VOICES[0].id],
    ["gemini", defaults.geminiKey, GEMINI_VOICES[0].id],
    ["elevenlabs", defaults.elevenlabsKey, ""],
    ["openai", defaults.openaiKey, "nova"],
  ];
  const found = order.find(([, key]) => Boolean(key));
  return voiceSchema.parse(found ? { provider: found[0], voiceId: found[2] } : {});
}

export function createEmptyProject(
  id: string,
  nowIso: string,
  defaults: Partial<Settings> = {},
): Project {
  return projectSchema.parse({
    id,
    title: "새 여행 숏폼",
    createdAt: nowIso,
    updatedAt: nowIso,
    status: "draft",
    hookAngle: "condition",
    product: productSchema.parse({}),
    assets: [],
    scenes: [],
    // New projects start on the benchmark template (@heo.jinny.gogo style spoken-subtitle reel).
    style: styleSchema.parse({ template: "review", watermark: defaults.instagramHandle ?? "" }),
    voice: defaultVoice(defaults),
    copy: copySchema.parse({ commentKeyword: defaults.defaultCommentKeyword ?? "숙소" }),
    render: { status: "idle", progress: 0 },
  });
}
