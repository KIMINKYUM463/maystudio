import { z } from "zod";
import { assertPublicHttpUrl } from "../import-parser";
import { MAX_ASSETS, MAX_SCENE_SHOTS, type Asset, type Project, type Scene, type Settings } from "../types";
import { deleteProjectFile, saveImageAsset } from "./assets";
import { callProvider, extractJson, hasLlm } from "./llm";
import { askVision, visionReady } from "./photo-classify";

/**
 * Free scenery between the stay's own photos: 1~2 shots that fit what the line says ("바다 보면서" →
 * "east sea sunrise korea"), from Openverse (Wikimedia, Flickr, …). Only licences that allow commercial
 * use and editing (CC0, CC BY, CC BY-SA), and every one is credited in the caption.
 */
const OPENVERSE = "https://api.openverse.org/v1/images/";
const SHOTS = 2;
/** Middle and closing beats; the hook stays the stay's own best photo. */
const TARGET_SCENES = ["proof", "extras", "closing"];

/** Romanized place names for the no-AI fallback query. */
const PLACES: Record<string, string> = {
  서울: "Seoul", 부산: "Busan", 제주: "Jeju", 강릉: "Gangneung", 속초: "Sokcho", 양양: "Yangyang", 고성: "Goseong",
  여수: "Yeosu", 경주: "Gyeongju", 가평: "Gapyeong", 남해: "Namhae", 통영: "Tongyeong", 거제: "Geoje", 전주: "Jeonju",
  포항: "Pohang", 태안: "Taean", 인천: "Incheon", 평창: "Pyeongchang", 춘천: "Chuncheon", 강원: "Gangwon",
  경기: "Gyeonggi", 횡성: "Hoengseong", 홍천: "Hongcheon", 단양: "Danyang", 담양: "Damyang", 울산: "Ulsan",
  삼척: "Samcheok", 동해: "Donghae", 서귀포: "Seogwipo", 안동: "Andong", 대구: "Daegu", 대전: "Daejeon",
};

/** Titles that mean a building or lodging: another stay could be mistaken for this one. */
const BUILT = /hotel|resort|inn|motel|hostel|house|home|building|room|lodge|cabin|villa|pool|spa|bath|onsen|sauna|restaurant|cafe|church|temple|castle|people|man|woman|girl|boy|portrait|selfie|frost|macro|abstract/i;

/**
 * The result most likely to be plain scenery of the asked subject: title mentions a query word and no
 * building/people/close-up word. Openverse relevance alone returned frost close-ups for "pine forest".
 */
export function bestScenery<T extends { title?: string | null; url: string }>(results: T[], query: string, used: Set<string>): T | undefined {
  return sceneryCandidates(results, query, used)[0];
}

export function sceneryCandidates<T extends { title?: string | null; url: string }>(results: T[], query: string, used: Set<string>): T[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const fresh = results.filter((r) => !used.has(r.url) && !BUILT.test(r.title ?? ""));
  return fresh.filter((r) => words.some((w) => (r.title ?? "").toLowerCase().includes(w)));
}

const CHECK_PROMPT = (query: string) =>
  `Is this a real, wide photograph of natural outdoor scenery that matches "${query}" (landscape, sky, forest, mountains, water)?
Answer false for close-ups, textures, abstract or artistic shots, any building or facility, people, text or logos.
JSON only: {"ok":true} or {"ok":false}`;

/** The vision AI confirms the photo really is plain scenery (titles lie: "Pine Forest" was frost on glass). */
async function looksLikeScenery(bytes: Buffer, query: string, settings: Settings): Promise<boolean> {
  if (!visionReady(settings)) return true;
  try {
    const text = await askVision(settings, [{ index: 0, mime: "image/jpeg", data: bytes.toString("base64") }], CHECK_PROMPT(query));
    return z.object({ ok: z.boolean() }).parse(extractJson(text)).ok;
  } catch {
    return false;
  }
}

const CHECKS_PER_SCENE = 4;

/** Always-findable scenery when nothing better is known. */
const GENERIC = ["forest landscape", "mountain sunrise", "night sky stars", "sea sunset"];

export function placeQuery(region: string): string | null {
  const words = region.split(/[\s,·]+/).reverse();
  const place = words.map((w) => PLACES[w.replace(/(시|군|구|도)$/, "")] ?? PLACES[w]).find(Boolean);
  return place ? `${place} landscape` : null;
}

const resultSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().nullable().default(""),
      url: z.string(),
      creator: z.string().nullable().default(""),
      license: z.string(),
      license_version: z.string().nullable().default(""),
      foreign_landing_url: z.string().nullable().default(""),
      width: z.number().nullable().default(0),
      height: z.number().nullable().default(0),
    }),
  ),
});
type Found = z.infer<typeof resultSchema>["results"][number];

export function licenseLabel(license: string, version?: string | null): string {
  return license === "cc0" ? "CC0" : `CC ${license.toUpperCase()}${version ? ` ${version}` : ""}`;
}

export async function search(query: string): Promise<Found[]> {
  const params = new URLSearchParams({
    q: query,
    license: "cc0,by,by-sa",
    category: "photograph",
    page_size: "20",
    mature: "false",
  });
  const res = await fetch(`${OPENVERSE}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`풍경 소재 검색 실패 (${res.status})`);
  // Openverse mostly serves 1024px previews (1024x683); that fills the frame once the camera crops in.
  return resultSchema
    .parse(await res.json())
    .results.filter((r) => Math.max(r.width ?? 0, r.height ?? 0) >= 1000 && Math.min(r.width ?? 0, r.height ?? 0) >= 600);
}

const QUERY_PROMPT = `You pick free stock scenery for a Korean travel reel. You get some script lines, each with an "id".
For EACH id write one short English image search query (2~3 plain words) for nature or scenery that matches the mood of that line:
e.g. "pine forest", "starry night sky", "snowy mountains", "misty lake", "sunrise sea", "autumn leaves", "falling snow".
Nature and sky only. Never pools, hot springs, baths, saunas, rooms, buildings or any facility: viewers would take them for the
stay's own (misleading advertising). Also no place names (they find nothing), people or brands.
Output JSON only, keyed by the given ids: {"queries":{"proof":"pine forest","closing":"snowy mountains"}}`;

export async function queriesFor(project: Pick<Project, "product">, scenes: Scene[], settings: Settings): Promise<Record<string, string>> {
  const fallback = placeQuery(project.product.region);
  if (!hasLlm(settings)) return fallback ? Object.fromEntries(scenes.map((s) => [s.id, fallback])) : {};
  const user = JSON.stringify({
    region: project.product.region,
    stayType: project.product.stayType,
    lines: scenes.map((s) => ({ id: s.id, line: s.narration || s.caption })),
  });
  try {
    const parsed = z
      .object({ queries: z.record(z.string(), z.string().max(80)) })
      .parse(extractJson(await callProvider(settings, QUERY_PROMPT, user)));
    // Keep only answers for the scenes asked about (models sometimes key by topic instead).
    const byId = Object.fromEntries(scenes.filter((sc) => parsed.queries[sc.id]).map((sc) => [sc.id, parsed.queries[sc.id]]));
    return Object.keys(byId).length ? byId : Object.fromEntries(scenes.map((sc, i) => [sc.id, Object.values(parsed.queries)[i] ?? GENERIC[i % GENERIC.length]]));
  } catch {
    return fallback ? Object.fromEntries(scenes.map((s) => [s.id, fallback])) : {};
  }
}

/** Drops scenery from an earlier script (files and scene references) so regenerating doesn't pile them up. */
export async function removeOldScenery(projectId: string, assets: Asset[], scenes: Scene[]): Promise<{ assets: Asset[]; scenes: Scene[] }> {
  const old = new Set(assets.filter((a) => a.scenery).map((a) => a.id));
  if (!old.size) return { assets, scenes };
  await Promise.all(assets.filter((a) => old.has(a.id)).flatMap((a) => [deleteProjectFile(projectId, a.file), deleteProjectFile(projectId, a.originalFile)]));
  return {
    assets: assets.filter((a) => !old.has(a.id)),
    scenes: scenes.map((s) => ({
      ...s,
      assetId: s.assetId && old.has(s.assetId) ? (s.extraAssetIds.find((id) => !old.has(id)) ?? null) : s.assetId,
      extraAssetIds: s.extraAssetIds.filter((id) => !old.has(id)),
    })),
  };
}

/** Puts `assetId` in the middle of a scene's quick cuts (never first: the line opens on the stay). */
export function insertCut(scene: Scene, assetId: string): Scene {
  const extra = [...scene.extraAssetIds];
  if (1 + extra.length >= MAX_SCENE_SHOTS) extra.splice(Math.floor(extra.length / 2), 1);
  extra.splice(Math.ceil(extra.length / 2), 0, assetId);
  return { ...scene, extraAssetIds: extra };
}

export async function addScenery(
  projectId: string,
  project: Pick<Project, "product" | "assets">,
  scenes: Scene[],
  settings: Settings,
): Promise<{ assets: Asset[]; scenes: Scene[] }> {
  let assets = project.assets;
  const slots = Math.min(SHOTS, MAX_ASSETS - assets.length);
  const targets = scenes.filter((s) => TARGET_SCENES.includes(s.id)).slice(0, slots);
  if (!targets.length) return { assets, scenes };
  const queries = await queriesFor(project, targets, settings);
  const used = new Set<string>();
  for (const scene of targets) {
    const query = queries[scene.id];
    if (!query) continue;
    try {
      // Long AI queries ("forest hot spring night korea") often match nothing; retry shorter, then the region.
      const words = query.split(/\s+/);
      const tries = [query, words.slice(-2).join(" "), words.at(-1) ?? "", GENERIC[used.size % GENERIC.length]].filter(Boolean);
      let pick: Found | undefined;
      let bytes: Buffer | undefined;
      let checked = 0;
      for (const q of [...new Set(tries)]) {
        for (const candidate of sceneryCandidates(await search(q), q, used)) {
          if (checked++ >= CHECKS_PER_SCENE) break;
          used.add(candidate.url);
          const res = await fetch(assertPublicHttpUrl(candidate.url), { signal: AbortSignal.timeout(20_000) });
          if (!res.ok) continue;
          const data = Buffer.from(await res.arrayBuffer());
          if (await looksLikeScenery(data, q, settings)) {
            [pick, bytes] = [candidate, data];
            break;
          }
        }
        if (pick || checked >= CHECKS_PER_SCENE) break;
      }
      if (!pick || !bytes) continue;
      const asset = await saveImageAsset(projectId, bytes, "풍경");
      const credited: Asset = {
        ...asset,
        scenery: true,
        group: "other",
        // Checked to have no people above; skip the face mosaic (it misread water ripples as a face).
        faceChecked: true,
        credit: {
          title: (pick.title ?? "").slice(0, 200),
          author: (pick.creator || "작자 미상").slice(0, 120),
          license: licenseLabel(pick.license, pick.license_version),
          url: (pick.foreign_landing_url || pick.url).slice(0, 500),
        },
      };
      assets = [...assets, credited];
      scenes = scenes.map((s) => (s.id === scene.id ? insertCut(s, credited.id) : s));
    } catch (error) {
      console.error("[scenery]", query, error);
    }
  }
  return { assets, scenes };
}
