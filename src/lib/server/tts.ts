import { parseBuffer } from "music-metadata";
import { ELEVENLABS_DEFAULT_VOICE, GEMINI_VOICES, TYPECAST_VOICES, type Project, type Settings, type Voice } from "../types";
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
  if (voice.provider === "typecast") return settings.typecastKey;
  if (voice.provider === "gemini") return settings.geminiKey;
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
  if (voice.provider === "typecast") {
    return fetchAudio("https://api.typecast.ai/v1/text-to-speech", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: voice.voiceId || TYPECAST_VOICES[0].id,
        text,
        model: "ssfm-v30",
        language: "kor",
        prompt: { emotion_type: "preset", emotion_preset: "happy", emotion_intensity: 1 },
        output: { audio_format: "mp3", audio_tempo: voice.speed },
      }),
    });
  }
  if (voice.provider === "gemini") return synthesizeGemini(text, voice, key);
  throw new Error("음성 제공자가 '없음'으로 설정되어 있습니다.");
}

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_SAMPLE_RATE = 24_000;

/** Gemini returns raw 16-bit mono PCM; wrap it in a WAV header so players and Remotion can read it. */
export function pcmToWav(pcm: Buffer, sampleRate = GEMINI_SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesizeGemini(text: string, voice: Voice, key: string): Promise<Buffer> {
  // Gemini has no speed parameter; the pace is asked for in words.
  const pace = voice.speed >= 1.15 ? "조금 빠르게" : voice.speed <= 0.9 ? "천천히" : "자연스러운 속도로";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `설레는 여행 크리에이터가 친구에게 말하듯 밝게, ${pace} 읽어줘: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.voiceId || GEMINI_VOICES[0].id } } },
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`음성 생성 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error("Gemini가 음성을 돌려주지 않았습니다.");
  const rate = Number(inline.mimeType?.match(/rate=(\d+)/)?.[1]) || GEMINI_SAMPLE_RATE;
  return pcmToWav(Buffer.from(inline.data, "base64"), rate);
}

export async function audioDurationSec(buffer: Buffer): Promise<number> {
  const isWav = buffer.subarray(0, 4).toString("ascii") === "RIFF";
  const meta = await parseBuffer(buffer, { mimeType: isWav ? "audio/wav" : "audio/mpeg" }, { duration: true });
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
