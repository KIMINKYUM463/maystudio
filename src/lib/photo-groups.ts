import { z } from "zod";
import type { Asset } from "./types";

/**
 * Photo groups from the 런비 recipe: 7 shots = water 3 + signature 2 + room 2, water first.
 * "other" is everything that sells nothing (lobby, parking, corridors).
 */
export const PHOTO_GROUPS = ["water", "signature", "room", "other"] as const;
export type PhotoGroup = (typeof PHOTO_GROUPS)[number];

export const photoClassSchema = z.object({
  index: z.number().int().min(0),
  label: z.string().trim().min(1).max(30),
  group: z.enum(PHOTO_GROUPS),
  /** 1~5: how likely this frame stops a scroll as the reel's opening shot. */
  score: z.number().min(1).max(5),
});
export type PhotoClass = z.infer<typeof photoClassSchema>;

export const classificationSchema = z.object({ photos: z.array(photoClassSchema) });

/** Labels the importer or uploader give that say nothing about the shot; AI labels may replace them. */
const GENERIC_LABELS = new Set(["", "전경", "기본", "객실", "외관", "사진", "이미지", "숙소", "대표 사진", "대표사진", "부대시설", "photo", "image"]);
export const isGenericLabel = (label: string) => GENERIC_LABELS.has(label.trim().toLowerCase());
/** Names that are real but sell nothing in a ✔️ list or a fact line ("숲속 숙소 계단", "숙소 외관"). */
export const isWeakLabel = (label: string) => isGenericLabel(label) || /외관|전경|계단|입구|복도|주차|로비|대표|부대시설/.test(label);

/**
 * Applies AI labels (keeping labels the user typed) and reorders: water, signature, room, other,
 * each group best-first. Photos the AI skipped keep their relative order at the end.
 */
export function applyPhotoClasses(assets: Asset[], classes: PhotoClass[]): Asset[] {
  const byIndex = new Map(classes.filter((c) => c.index < assets.length).map((c) => [c.index, c]));
  const rank = (i: number) => {
    const c = byIndex.get(i);
    return c ? PHOTO_GROUPS.indexOf(c.group) * 10 - c.score : 100;
  };
  return assets
    .map((asset, i) => ({ asset, i }))
    .sort((a, b) => rank(a.i) - rank(b.i) || a.i - b.i)
    .map(({ asset, i }) => {
      const c = byIndex.get(i);
      if (!c) return asset;
      return { ...asset, group: c.group, label: isGenericLabel(asset.label) ? c.label.slice(0, 30) : asset.label };
    });
}

/** Counts per group, for the "물놀이 3·시그니처 2·객실 2" checklist. */
export function groupCounts(classes: PhotoClass[]): Record<PhotoGroup, number> {
  const counts = { water: 0, signature: 0, room: 0, other: 0 };
  for (const c of classes) counts[c.group] += 1;
  return counts;
}

const MAX_FEATURES = 6;

/**
 * Listings often give only 2~3 facts, which leaves the "심지어" beat with nothing new to say. Water and
 * signature photo names the AI read off the photos ("야외 스케이트장", "히노끼 욕조") fill the list up.
 */
export function featuresFromPhotos(features: string[], assets: Pick<Asset, "label" | "group">[]): string[] {
  const list = features.map((f) => f.trim()).filter(Boolean);
  const norm = (s: string) => s.replace(/\s/g, "");
  const covered = (label: string) => list.some((f) => norm(f).includes(norm(label)) || norm(label).includes(norm(f)));
  for (const asset of assets) {
    if (list.length >= MAX_FEATURES) break;
    const label = asset.label.trim();
    if ((asset.group !== "water" && asset.group !== "signature") || isWeakLabel(label) || covered(label)) continue;
    list.push(label);
  }
  return list;
}

/** AI video costs per clip; once photos are sorted, only the shots that sell (water 3 + signature 2) move. */
export const ANIMATE_PICKS = { water: 3, signature: 2 } as const;

export function animateTargets<T extends Pick<Asset, "group" | "videoFile">>(assets: T[]): T[] {
  const stills = assets.filter((a) => !a.videoFile);
  if (!assets.some((a) => a.group)) return stills;
  const done = (group: "water" | "signature") => assets.filter((a) => a.group === group && a.videoFile).length;
  return (["water", "signature"] as const).flatMap((group) =>
    stills.filter((a) => a.group === group).slice(0, Math.max(0, ANIMATE_PICKS[group] - done(group))),
  );
}
