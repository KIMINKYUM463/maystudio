import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { isGenericLabel } from "../photo-groups";
import type { Project } from "../types";
import { projectFilePath } from "./store";

export type LookbookPhoto = { projectId: string; file: string; label: string };

/** Shots that sell a stay at a glance go first: water, views, night. */
const HERO_LABEL = /수영장|풀|스파|자쿠지|온천|노천|욕조|오션|뷰|야경|정원|테라스|외관|전경/;
const PER_PROJECT = 6;
const MAX_PHOTOS = 30;

/**
 * Home lookbook strip: real stay photos across projects, deduplicated by file content (copied
 * projects and imports often carry the same image under another name), dealt round-robin so
 * neighbouring tiles come from different stays. Sample projects (stock scenery) are skipped.
 */
export async function lookbookPhotos(projects: Project[]): Promise<LookbookPhoto[]> {
  const seen = new Set<string>();
  const perProject: LookbookPhoto[][] = [];
  for (const p of projects) {
    if (p.title.startsWith("[샘플]")) continue;
    const ranked = [...p.assets].sort((a, b) => Number(HERO_LABEL.test(b.label)) - Number(HERO_LABEL.test(a.label)));
    const picked: LookbookPhoto[] = [];
    for (const asset of ranked) {
      if (picked.length >= PER_PROJECT) break;
      const buffer = await fs.readFile(projectFilePath(p.id, asset.file)).catch(() => null);
      if (!buffer) continue;
      const hash = createHash("sha1").update(buffer).digest("hex");
      if (seen.has(hash)) continue;
      seen.add(hash);
      picked.push({
        projectId: p.id,
        file: asset.file,
        label: isGenericLabel(asset.label) ? p.product.region || p.product.stayType || "숙소" : asset.label,
      });
    }
    if (picked.length) perProject.push(picked);
  }
  const dealt: LookbookPhoto[] = [];
  for (let round = 0; dealt.length < MAX_PHOTOS && perProject.some((list) => list[round]); round++) {
    for (const list of perProject) if (list[round] && dealt.length < MAX_PHOTOS) dealt.push(list[round]);
  }
  return dealt;
}
