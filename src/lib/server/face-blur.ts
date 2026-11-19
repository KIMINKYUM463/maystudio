import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import sharp, { type OverlayOptions } from "sharp";
import { z } from "zod";
import type { Project } from "../types";
import { extractJson } from "./llm";
import { askVision, loadPhotos, visionReady } from "./photo-classify";
import { getProject, getSettings, projectFilePath, updateProject } from "./store";

const SCRIPT = path.join(/*turbopackIgnore: true*/ process.cwd(), "scripts", "detect-faces.py");
const PYTHON = process.env.MAYSTUDIO_PYTHON ?? "python";

/**
 * Face boxes from OpenCV YuNet (scripts/detect-faces.py), one list per image, or null when Python/OpenCV
 * isn't available. Preferred: in testing (2026-11-19) it found all 4 faces exactly, while Gemini's boxes
 * moved between calls and often missed the face.
 */
async function detectWithOpenCv(files: string[]): Promise<FaceBox[][] | null> {
  try {
    const { stdout } = await promisify(execFile)(PYTHON, [SCRIPT, ...files], { timeout: 120_000, maxBuffer: 4 << 20 });
    const parsed = z.object({ results: z.array(z.object({ faces: z.array(box) })) }).parse(JSON.parse(stdout));
    return parsed.results.length === files.length ? parsed.results.map((r) => r.faces) : null;
  } catch (error) {
    console.error("[faces] OpenCV detector unavailable, falling back to the vision AI", error);
    return null;
  }
}

// Fallback only. Gemini's trained box format ("box_2d", one image per call).
const PROMPT = `Detect every human face in this photo, including small, side and partly hidden faces. Ignore paintings, statues and mannequins.
Return JSON only: {"faces":[{"box_2d":[ymin,xmin,ymax,xmax]}]} with coordinates normalized to 0-1000. Use {"faces":[]} when there is no face.`;

const box = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type FaceBox = z.infer<typeof box>;
const facesSchema = z.object({ faces: z.array(z.object({ box_2d: box })).default([]) });
const CONCURRENCY = 4;

/**
 * Pixelates each face box (0~1000 coords, padded so hair and jaw are covered). EXIF rotation is
 * applied first so the boxes the AI saw line up with the pixels written back.
 */
export async function pixelateFaces(input: Buffer, faces: FaceBox[]): Promise<Buffer> {
  const base = await sharp(input).rotate().toBuffer();
  const { width = 0, height = 0, format } = await sharp(base).metadata();
  const overlays: OverlayOptions[] = [];
  for (const [y0, x0, y1, x1] of faces) {
    const padX = ((x1 - x0) / 1000) * width * 0.25;
    const padY = ((y1 - y0) / 1000) * height * 0.25;
    const left = Math.max(0, Math.floor((x0 / 1000) * width - padX));
    const top = Math.max(0, Math.floor((y0 / 1000) * height - padY));
    const right = Math.min(width, Math.ceil((x1 / 1000) * width + padX));
    const bottom = Math.min(height, Math.ceil((y1 / 1000) * height + padY));
    const w = right - left;
    const h = bottom - top;
    if (w < 4 || h < 4) continue;
    // ~10 blocks across the face: unreadable, but clearly a mosaic rather than a smudge.
    const cells = Math.max(4, Math.round(10 * Math.min(1, w / h)));
    const small = await sharp(base)
      .extract({ left, top, width: w, height: h })
      .resize(cells, Math.max(4, Math.round((cells * h) / w)), { kernel: "nearest" })
      .toBuffer();
    overlays.push({ input: await sharp(small).resize(w, h, { kernel: "nearest" }).toBuffer(), left, top });
  }
  if (!overlays.length) return input;
  return sharp(base).composite(overlays).toFormat(format === "png" ? "png" : format === "webp" ? "webp" : "jpeg", { quality: 92 }).toBuffer();
}

/**
 * Looks for faces in photos not checked yet and mosaics them into a "-mosaic" copy that replaces the
 * photo (the original file stays as originalFile). Uses OpenCV when Python has it, else the vision AI;
 * with neither it does nothing.
 */
export async function blurNewFaces(projectId: string): Promise<{ project: Project; blurred: number }> {
  const [project, settings] = await Promise.all([getProject(projectId), getSettings()]);
  const pending = project.assets.filter((a) => !a.faceChecked);
  if (!pending.length) return { project, blurred: 0 };
  const found: { index: number; faces: FaceBox[] }[] = [];
  const local = await detectWithOpenCv(pending.map((a) => projectFilePath(projectId, a.file)));
  if (local) {
    pending.forEach((a, i) => found.push({ index: project.assets.indexOf(a), faces: local[i] }));
  } else if (!visionReady(settings)) {
    return { project, blurred: 0 };
  }
  const photos = local ? [] : await loadPhotos(project, new Set(pending.map((a) => a.id)));
  for (let i = 0; i < photos.length; i += CONCURRENCY) {
    const batch = photos.slice(i, i + CONCURRENCY);
    const answers = await Promise.all(batch.map((photo) => askVision(settings, [photo], PROMPT)));
    answers.forEach((text, j) =>
      found.push({ index: batch[j].index, faces: facesSchema.parse(extractJson(text)).faces.map((f) => f.box_2d) }),
    );
  }

  // The mosaic gets a new file name so browsers and the preview don't keep showing a cached original.
  const blurredFiles = new Map<string, string>();
  for (const { index, faces } of found) {
    const asset = project.assets[index];
    if (!asset || !faces.length || asset.faceChecked) continue;
    const { dir, name, ext } = path.posix.parse(asset.file);
    const blurredFile = path.posix.join(dir, `${name}-mosaic${ext}`);
    const bytes = await fs.readFile(projectFilePath(projectId, asset.file));
    await fs.writeFile(projectFilePath(projectId, blurredFile), await pixelateFaces(bytes, faces));
    blurredFiles.set(asset.id, blurredFile);
  }
  const checked = new Set(found.map((f) => project.assets[f.index]?.id));
  const updated = await updateProject(projectId, (p) => ({
    ...p,
    assets: p.assets.map((a) =>
      checked.has(a.id)
        ? { ...a, faceChecked: true, ...(blurredFiles.has(a.id) ? { file: blurredFiles.get(a.id)!, originalFile: a.file } : {}) }
        : a,
    ),
  }));
  return { project: updated, blurred: blurredFiles.size };
}

/** Puts the untouched photo back (the AI blurred something that wasn't a face, or the user wants it). */
export async function restoreOriginal(projectId: string, assetId: string): Promise<Project> {
  const project = await getProject(projectId);
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset?.originalFile) return project;
  const original = asset.originalFile;
  const updated = await updateProject(projectId, (p) => ({
    ...p,
    assets: p.assets.map((a) => (a.id === assetId ? { ...a, file: original, originalFile: undefined } : a)),
  }));
  await fs.rm(projectFilePath(projectId, asset.file), { force: true });
  return updated;
}
