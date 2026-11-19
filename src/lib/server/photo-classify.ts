import fs from "node:fs/promises";
import { classificationSchema, type PhotoClass } from "../photo-groups";
import type { Project, Settings } from "../types";
import { extractJson } from "./llm";
import { projectFilePath } from "./store";

/** Inline-image budget per photo; bigger files are skipped rather than blowing the request size. */
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const PROMPT = `너는 숙소 릴스 편집자다. 아래 사진들은 한 숙소의 공식 사진이고, 순서대로 index 0부터 번호가 붙어 있다.
각 사진마다 다음을 정해라.
- label: 사진에 보이는 것을 8자 이내 한국어로 구체적으로. 예: 야외수영장, 실내수영장, 노천탕, 객실 자쿠지, 히노끼 욕조, 침실, 거실, 오션뷰 객실, 외관, 야경, 로비, 조식, 정원, 바베큐장, 미디어아트
- group: water(수영장·스파·온천·노천탕·자쿠지·욕조 등 물이 보이는 시설) / signature(이 숙소에만 있는 볼거리: 뷰, 독특한 건축·인테리어, 정원, 야경, 체험 공간) / room(침실·거실·주방 등 객실 내부) / other(로비·입구, 주차장, 복도, 간판·표지판, 지도, 차량, 주류·브랜드 로고가 크게 보이는 사진, 사람 얼굴 클로즈업 등 숙소 영상에 쓰면 안 되거나 매력 없는 사진)
- score: 1~5. 릴스 첫 화면에 나왔을 때 스크롤을 멈추게 할 정도. 선명하고 화려하고 사람이 가고 싶어지면 5, 흐리거나 평범하면 1.
사진에 없는 것을 지어내지 마라. 반드시 다음 JSON만 출력: {"photos":[{"index":0,"label":"...","group":"water","score":4}]}`;

type Photo = { index: number; mime: string; data: string };

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

async function loadPhotos(project: Project): Promise<Photo[]> {
  const photos: Photo[] = [];
  for (const [index, asset] of project.assets.entries()) {
    const mime = MIME[asset.file.split(".").pop()?.toLowerCase() ?? ""];
    if (!mime) continue;
    const buffer = await fs.readFile(projectFilePath(project.id, asset.file)).catch(() => null);
    if (!buffer || buffer.byteLength > MAX_PHOTO_BYTES) continue;
    photos.push({ index, mime, data: buffer.toString("base64") });
  }
  return photos;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`사진 분류 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function askGemini(settings: Settings, photos: Photo[]): Promise<string> {
  const parts = photos.flatMap((p) => [{ text: `index ${p.index}` }, { inlineData: { mimeType: p.mime, data: p.data } }]);
  const data = (await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiModel)}:generateContent`,
    {
      contents: [{ role: "user", parts: [{ text: PROMPT }, ...parts] }],
      generationConfig: { responseMimeType: "application/json" },
    },
    { "x-goog-api-key": settings.geminiKey },
  )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function askOpenAi(settings: Settings, photos: Photo[]): Promise<string> {
  const content = [
    { type: "text", text: PROMPT },
    ...photos.flatMap((p) => [
      { type: "text", text: `index ${p.index}` },
      { type: "image_url", image_url: { url: `data:${p.mime};base64,${p.data}`, detail: "low" } },
    ]),
  ];
  const data = (await postJson(
    "https://api.openai.com/v1/chat/completions",
    {
      model: settings.openaiModel,
      ...(/^(gpt-5|o\d)/.test(settings.openaiModel) ? { reasoning_effort: "low" } : {}),
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    },
    { Authorization: `Bearer ${settings.openaiKey}` },
  )) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

export function visionReady(settings: Settings): boolean {
  return Boolean(settings.geminiKey || settings.openaiKey);
}

/** Gemini first (cheap, many images per call), OpenAI as the fallback. */
export async function classifyPhotos(project: Project, settings: Settings): Promise<PhotoClass[]> {
  if (!visionReady(settings)) throw new Error("사진 분류에는 Gemini 또는 OpenAI 키가 필요해요. 설정에서 넣어주세요.");
  const photos = await loadPhotos(project);
  if (photos.length === 0) throw new Error("분류할 사진이 없어요.");
  const text = settings.geminiKey ? await askGemini(settings, photos) : await askOpenAi(settings, photos);
  return classificationSchema.parse(extractJson(text)).photos;
}
