import { extname } from "node:path";
import { DEFAULT_REPLICATE_MODEL, REPLICATE_I2V_MODELS } from "../replicate-models";
import type { Settings } from "../types";
import { BadRequestError } from "./http";

export { DEFAULT_REPLICATE_MODEL, REPLICATE_I2V_MODELS } from "../replicate-models";
export type { ReplicateModelId } from "../replicate-models";
export type PredictionStatus = "starting" | "processing" | "succeeded" | "failed" | "canceled";
export type Prediction = { id: string; status: PredictionStatus; output?: unknown; error?: string | null };

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export function imageDataUri(buffer: Buffer, file: string): string {
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime) throw new BadRequestError("Replicate는 JPG·PNG·WEBP만 영상으로 바꿀 수 있어요.");
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Official I2V models each name the still differently. */
export function i2vInput(model: string, image: string, prompt: string): Record<string, unknown> {
  if (model.includes("kling")) return { start_image: image, prompt, duration: 5 };
  if (model.includes("seedance")) return { image, prompt, duration: 5, resolution: "720p", aspect_ratio: "9:16" };
  return { image, prompt };
}

export function outputFileUrl(output: unknown): string | null {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = outputFileUrl(item);
      if (url) return url;
    }
  }
  if (output && typeof output === "object" && "href" in output && typeof (output as { href: unknown }).href === "string") {
    return (output as { href: string }).href;
  }
  return null;
}

async function replicateJson(key: string, url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  if (!res.ok) {
    const detail = typeof data === "object" && data && "detail" in data ? String((data as { detail: unknown }).detail) : text;
    throw new BadRequestError(`Replicate 오류 (${res.status}): ${detail.slice(0, 240)}`);
  }
  return data;
}

export function modelIdFor(settings: Pick<Settings, "replicateModel">): string {
  const wanted = settings.replicateModel.trim() || DEFAULT_REPLICATE_MODEL;
  return REPLICATE_I2V_MODELS.some((m) => m.id === wanted) ? wanted : DEFAULT_REPLICATE_MODEL;
}

export async function createI2vPrediction(settings: Settings, image: string, prompt: string): Promise<Prediction> {
  if (!settings.replicateKey.trim()) throw new BadRequestError("설정에서 Replicate API 토큰을 입력하세요.");
  const model = modelIdFor(settings);
  const data = (await replicateJson(
    settings.replicateKey,
    `https://api.replicate.com/v1/models/${model}/predictions`,
    { method: "POST", body: JSON.stringify({ input: i2vInput(model, image, prompt) }) },
  )) as Prediction;
  if (!data?.id) throw new BadRequestError("Replicate가 작업 ID를 주지 않았어요.");
  return data;
}

export async function getPrediction(settings: Settings, id: string): Promise<Prediction> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new BadRequestError("잘못된 작업 ID예요.");
  return (await replicateJson(settings.replicateKey, `https://api.replicate.com/v1/predictions/${id}`)) as Prediction;
}

export async function downloadPredictionFile(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new BadRequestError(`영상을 받지 못했어요 (${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength < 32) throw new BadRequestError("받은 영상 파일이 비어 있어요.");
  return buffer;
}
