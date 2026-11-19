import { promises as fs } from "node:fs";
import sharp from "sharp";
import { z } from "zod";
import type { Project, Scene, Settings } from "../types";
import { extractJson } from "./llm";
import { askVision, visionReady, type Photo } from "./photo-classify";
import { projectFilePath } from "./store";

/**
 * Picks which photos each line shows by LOOKING at them, not by their names. Listing names are often
 * brand words ("CAVERN", "SHADE", "FLOAT") that say nothing about the shot, so word matching dealt them
 * out in list order.
 */
const PROMPT = (lines: string, names: string, cover: number) => `You edit a short Korean travel reel. The photos are labelled "index N" (N = photo number).
Their listing names, which may be vague brand words, are: ${names}
Below are the script lines in order, each with how many photo cuts it needs ("cuts").
For every line pick exactly that many photo numbers whose CONTENT matches what the line says
(e.g. a line about an outdoor bath gets bath photos, a line about the room gets room photos, a line about
the exterior or location gets exterior/view photos). Trust what you see over the names.
The first line's first photo is fixed: photo ${cover} (it is also the cover). Start that line's list with ${cover}.
Use each photo at most once overall when there are enough photos; never the same photo twice in a row.
Lines:
${lines}
Output JSON only: {"scenes":{"<id>":[photo numbers in order]}}`;

const answerSchema = z.object({ scenes: z.record(z.string(), z.array(z.number().int().min(0))) });

/** Small JPEGs keep 20 photos in one request (originals can be several MB each). */
async function thumbs(project: Project, ids: string[]): Promise<Photo[]> {
  const photos: Photo[] = [];
  for (const [index, id] of ids.entries()) {
    const asset = project.assets.find((a) => a.id === id)!;
    try {
      const bytes = await fs.readFile(projectFilePath(project.id, asset.file));
      const small = await sharp(bytes).rotate().resize(512, 512, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
      photos.push({ index, mime: "image/jpeg", data: small.toString("base64") });
    } catch {
      // unreadable photo: just not offered
    }
  }
  return photos;
}

/**
 * Applies the AI's picks: keeps each scene's cut count, drops unknown numbers, avoids back-to-back repeats,
 * and fills any gap from the scene's previous photos. Pure, so it is tested without the AI.
 */
export function applyPicks(scenes: Scene[], picks: Record<string, number[]>, photoIds: string[]): Scene[] {
  return scenes.map((scene, index) => {
    const want = 1 + scene.extraAssetIds.length;
    // The opening photo is the cover; it never moves.
    const chosen: string[] = index === 0 && scene.assetId ? [scene.assetId] : [];
    for (const n of picks[scene.id] ?? []) {
      const id = photoIds[n];
      if (id && chosen.at(-1) !== id && chosen.length < want) chosen.push(id);
    }
    for (const id of [scene.assetId, ...scene.extraAssetIds]) {
      if (chosen.length >= want) break;
      if (id && chosen.at(-1) !== id && !chosen.includes(id)) chosen.push(id);
    }
    if (!chosen.length) return scene;
    const [assetId, ...extraAssetIds] = chosen;
    return { ...scene, assetId, extraAssetIds };
  });
}

/** Re-deals the stay's own photos to the lines by what they show. No vision key → scenes unchanged. */
export async function matchShotsByVision(project: Project, scenes: Scene[], settings: Settings): Promise<Scene[]> {
  if (!visionReady(settings)) return scenes;
  const own = project.assets.filter((a) => !a.scenery);
  if (own.length < 2) return scenes;
  const photos = await thumbs(project, own.map((a) => a.id));
  if (photos.length < 2) return scenes;
  const lines = scenes
    .map((s) => `- id "${s.id}" (cuts ${1 + s.extraAssetIds.length}): ${(s.narration || s.caption).replace(/\s+/g, " ")}`)
    .join("\n");
  const ids = own.map((a) => a.id);
  const names = own.map((a, i) => `${i}=${a.label || "?"}`).join(", ");
  const cover = Math.max(0, ids.indexOf(scenes[0]?.assetId ?? ""));
  const text = await askVision(settings, photos, PROMPT(lines, names, cover));
  return applyPicks(scenes, answerSchema.parse(extractJson(text)).scenes, ids);
}
