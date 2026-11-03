import { parseBuffer } from "music-metadata";
import { ELEVENLABS_DEFAULT_VOICE, type Project, type Settings, type Voice } from "../types";
import { deleteProjectFile, saveAudioFile } from "./assets";

async function fetchAudio(url: string, init: RequestInit): Promise<Buffer> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`음성 생성 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function ttsKeyFor(voice: Voice, settings: Settings): string {
  if (voice.provider === "openai") return settings.openaiKey;
  if (voice.provider === "elevenlabs") return settings.elevenlabsKey;
  return "";
}

export async function synthesize(text: string, voice: Voice, settings: Settings): Promise<Buffer> {
  const key = ttsKeyFor(voice, settings);
  if (!key) throw new Error("음성 API 키가 설정되지 않았습니다. 설정 화면에서 입력하세요.");
  if (voice.provider === "openai") {
    return fetchAudio("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: voice.voiceId || "nova",
        input: text,
        instructions: "밝고 자연스러운 한국어 여행 크리에이터 말투. 또박또박, 설레는 톤.",
        response_format: "mp3",
        speed: voice.speed,
      }),
    });
  }
  if (voice.provider === "elevenlabs") {
    const id = encodeURIComponent(voice.voiceId || ELEVENLABS_DEFAULT_VOICE);
    return fetchAudio(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.75, speed: voice.speed },
      }),
    });
  }
  throw new Error("음성 제공자가 '없음'으로 설정되어 있습니다.");
}

export async function audioDurationSec(buffer: Buffer): Promise<number> {
  const meta = await parseBuffer(buffer, { mimeType: "audio/mpeg" }, { duration: true });
  const duration = meta.format.duration;
  if (!duration || !Number.isFinite(duration)) throw new Error("음성 길이를 읽지 못했습니다.");
  return Math.round(duration * 100) / 100;
}

/** Generates one narration clip per scene and returns the updated project. */
export async function generateNarration(project: Project, settings: Settings): Promise<Project> {
  const scenes = [];
  for (const scene of project.scenes) {
    await deleteProjectFile(project.id, scene.audioFile);
    const text = scene.narration.trim();
    if (!text) {
      scenes.push({ ...scene, audioFile: undefined, audioDurationSec: undefined });
      continue;
    }
    const buffer = await synthesize(text, project.voice, settings);
    const audioFile = await saveAudioFile(project.id, buffer, scene.id);
    scenes.push({ ...scene, audioFile, audioDurationSec: await audioDurationSec(buffer) });
  }
  return { ...project, scenes };
}

export async function clearNarration(project: Project): Promise<Project> {
  for (const scene of project.scenes) await deleteProjectFile(project.id, scene.audioFile);
  return {
    ...project,
    scenes: project.scenes.map((s) => ({ ...s, audioFile: undefined, audioDurationSec: undefined })),
  };
}
