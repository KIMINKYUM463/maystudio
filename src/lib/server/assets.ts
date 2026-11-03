import { imageSize } from "image-size";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Asset } from "../types";
import { BRAND_DIR, newId, projectFilePath, resolveDataPath } from "./store";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const IMAGE_EXT: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export class AssetError extends Error {}

/** Validates bytes by decoding the header rather than trusting the filename. */
export function inspectImage(buffer: Buffer): { ext: string; width: number; height: number } {
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new AssetError("이미지는 15MB 이하만 가능합니다.");
  let info: ReturnType<typeof imageSize>;
  try {
    info = imageSize(buffer);
  } catch {
    throw new AssetError("지원하지 않는 이미지 형식입니다. (JPG, PNG, WEBP)");
  }
  const ext = IMAGE_EXT[info.type ?? ""];
  if (!ext || !info.width || !info.height) {
    throw new AssetError("지원하지 않는 이미지 형식입니다. (JPG, PNG, WEBP)");
  }
  return { ext, width: info.width, height: info.height };
}

export async function saveImageAsset(projectId: string, buffer: Buffer, label = ""): Promise<Asset> {
  const { ext, width, height } = inspectImage(buffer);
  const id = newId();
  const file = path.posix.join("assets", `${id}.${ext}`);
  const target = projectFilePath(projectId, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { id, file, label: label.slice(0, 30), width, height };
}

/**
 * Saves a channel logo into the project and a brand copy under DATA_DIR/brand so later
 * projects start with it. Returns both paths (project-relative and DATA_DIR-relative).
 */
export async function saveLogo(projectId: string, buffer: Buffer): Promise<{ file: string; brandFile: string }> {
  const { ext } = inspectImage(buffer);
  const name = `logo-${newId()}.${ext}`;
  const file = path.posix.join("assets", name);
  const brandFile = path.posix.join(BRAND_DIR, name);
  const target = projectFilePath(projectId, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  await fs.mkdir(path.dirname(resolveDataPath(brandFile)), { recursive: true });
  await fs.writeFile(resolveDataPath(brandFile), buffer);
  return { file, brandFile };
}

export async function deleteDataFile(file: string | undefined): Promise<void> {
  if (file) await fs.rm(resolveDataPath(file), { force: true });
}

export async function deleteProjectFile(projectId: string, file: string | undefined): Promise<void> {
  if (!file) return;
  await fs.rm(projectFilePath(projectId, file), { force: true });
}

const AUDIO_SIGNATURES: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  { ext: "mp3", test: (b) => b.subarray(0, 3).toString("latin1") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { ext: "wav", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WAVE" },
  { ext: "m4a", test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" },
];

export function detectAudioExt(buffer: Buffer): string {
  if (buffer.byteLength > MAX_AUDIO_BYTES) throw new AssetError("오디오는 20MB 이하만 가능합니다.");
  const match = AUDIO_SIGNATURES.find((s) => s.test(buffer));
  if (!match) throw new AssetError("지원하지 않는 오디오 형식입니다. (MP3, WAV, M4A)");
  return match.ext;
}

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const VIDEO_SIGNATURES: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  // ISO BMFF: "ftyp" box at offset 4; QuickTime brand "qt  " means .mov.
  { ext: "mov", test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && b.subarray(8, 12).toString("latin1") === "qt  " },
  { ext: "mp4", test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" },
  { ext: "webm", test: (b) => b.readUInt32BE(0) === 0x1a45dfa3 },
];

/** Validates an AI image-to-video clip by its container signature. */
export function detectVideoExt(buffer: Buffer): string {
  if (buffer.byteLength > MAX_VIDEO_BYTES) throw new AssetError("영상 클립은 100MB 이하만 가능합니다.");
  const match = buffer.byteLength >= 12 ? VIDEO_SIGNATURES.find((s) => s.test(buffer)) : undefined;
  if (!match) throw new AssetError("지원하지 않는 영상 형식입니다. (MP4, MOV, WEBM)");
  return match.ext;
}

export async function saveVideoClip(projectId: string, assetId: string, buffer: Buffer): Promise<string> {
  const ext = detectVideoExt(buffer);
  const file = path.posix.join("assets", `${assetId}-clip-${newId()}.${ext}`);
  const target = projectFilePath(projectId, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return file;
}

export async function saveAudioFile(projectId: string, buffer: Buffer, name: string): Promise<string> {
  const ext = detectAudioExt(buffer);
  const file = path.posix.join("audio", `${name}-${newId()}.${ext}`);
  const target = projectFilePath(projectId, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return file;
}
