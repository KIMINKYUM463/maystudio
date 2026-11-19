import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { BadRequestError, route } from "@/lib/server/http";
import { getSettings, resolveDataPath } from "@/lib/server/store";
import { synthesize, ttsKeyFor } from "@/lib/server/tts";
import { TTS_PROVIDERS } from "@/lib/types";

/** One line in the benchmark voice, so every voice is heard reading the same thing. */
const SAMPLE_TEXT = "문만 열면 바로 노천탕이 있는 말도 안 되는 숙소가 있어요. 이번 겨울, 방 다 차기 전에 꼭 저장해두세요.";

const querySchema = z.object({
  provider: z.enum(TTS_PROVIDERS).exclude(["none"]),
  voiceId: z.string().regex(/^[\w-]{1,60}$/),
});

/**
 * Sample clip for the voice picker. Generated once per voice (it costs an API call) and cached
 * under DATA_DIR/voice-samples, so later previews are instant and free.
 */
export const GET = route(async (request: Request) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) throw new BadRequestError("목소리 정보가 올바르지 않아요.");
  const { provider, voiceId } = parsed.data;
  const dir = resolveDataPath("voice-samples");
  await fs.mkdir(dir, { recursive: true });
  const base = path.join(dir, `${provider}-${voiceId}`);
  for (const ext of ["mp3", "wav"]) {
    const cached = await fs.readFile(`${base}.${ext}`).catch(() => null);
    if (cached) return new Response(new Uint8Array(cached), { headers: { "Content-Type": ext === "mp3" ? "audio/mpeg" : "audio/wav" } });
  }
  const settings = await getSettings();
  const voice = { provider, voiceId, speed: 1.1 };
  if (!ttsKeyFor(voice, settings)) throw new BadRequestError("이 목소리를 들으려면 설정에서 API 키를 넣어주세요.");
  const audio = await synthesize(SAMPLE_TEXT, voice, settings);
  const isWav = audio.subarray(0, 4).toString("ascii") === "RIFF";
  await fs.writeFile(`${base}.${isWav ? "wav" : "mp3"}`, audio);
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": isWav ? "audio/wav" : "audio/mpeg" } });
});
