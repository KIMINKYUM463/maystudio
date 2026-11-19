import { featuresFromPhotos } from "../photo-groups";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { findIdea, IDEA_THEMES, productFromIdea, STAY_IDEAS } from "../stay-ideas";
import { MAX_ASSETS, productSchema, type Asset, type Product, type Project } from "../types";
import { saveImageAsset } from "./assets";
import { getProject, projectFilePath, resolveDataPath, updateProject } from "./store";

/**
 * Stay catalog: ready-made photos + facts for the 숙소 추천 list, kept under DATA_DIR/catalog/<ideaId>/.
 * Listing sites block automated fetches, so picking a stay copies from here instead of scraping live.
 */
const CATALOG_DIR = "catalog";
const META = "meta.json";

const metaSchema = z.object({
  ideaId: z.string(),
  product: productSchema.partial(),
  assets: z.array(z.object({ file: z.string(), label: z.string(), group: z.enum(["water", "signature", "room", "other"]).optional() })),
  savedAt: z.string(),
});
type CatalogMeta = z.infer<typeof metaSchema>;

export type CatalogEntry = {
  ideaId: string;
  name: string;
  region: string;
  pitch: string;
  stayType: string;
  topViews: number;
  rating: string;
  features: string[];
  photoCount: number;
  /** DATA_DIR-relative path of the first (AI-sorted best) photo. */
  cover: string;
  /** First few photos, for the "가져오는 중" animation. */
  previews: string[];
};

const dirOf = (ideaId: string) => resolveDataPath(path.join(CATALOG_DIR, ideaId));

async function readMeta(ideaId: string): Promise<CatalogMeta | null> {
  try {
    return metaSchema.parse(JSON.parse(await fs.readFile(path.join(dirOf(ideaId), META), "utf8")));
  } catch {
    return null;
  }
}

export async function listCatalog(): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = [];
  for (const idea of STAY_IDEAS) {
    const meta = await readMeta(idea.id);
    if (!meta || meta.assets.length === 0) continue;
    const rel = (file: string) => path.posix.join(CATALOG_DIR, idea.id, file);
    entries.push({
      ideaId: idea.id,
      name: meta.product.name || idea.name,
      region: meta.product.region || idea.region,
      pitch: idea.pitch,
      stayType: meta.product.stayType || idea.stayType,
      topViews: idea.topViews,
      rating: meta.product.rating ?? "",
      features: meta.product.features ?? [],
      photoCount: meta.assets.length,
      cover: rel(meta.assets[0].file),
      previews: meta.assets.slice(0, 8).map((a) => rel(a.file)),
    });
  }
  return entries.sort((a, b) => b.topViews - a.topViews);
}

/** Facts worth carrying between projects; the affiliate link and notes from other branches are not. */
const CATALOG_FIELDS = ["name", "category", "region", "stayType", "features", "rating", "target", "occasion", "access", "notes", "sourceUrl", "platform"] as const;

/** Saves a project's (AI-sorted) photos and facts as the catalog entry for one recommended stay. */
export async function saveToCatalog(projectId: string, ideaId: string): Promise<CatalogEntry | undefined> {
  if (!findIdea(ideaId)) throw new Error("추천 목록에 없는 숙소예요.");
  const project = await getProject(projectId);
  const dir = dirOf(ideaId);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const assets: CatalogMeta["assets"] = [];
  for (const [i, asset] of project.assets.entries()) {
    const file = `p${String(i + 1).padStart(2, "0")}${path.extname(asset.file)}`;
    await fs.copyFile(projectFilePath(project.id, asset.file), path.join(dir, file));
    assets.push({ file, label: asset.label, group: asset.group });
  }
  const product = Object.fromEntries(CATALOG_FIELDS.map((k) => [k, project.product[k]])) as Partial<Product>;
  const meta: CatalogMeta = { ideaId, product, assets, savedAt: new Date().toISOString() };
  await fs.writeFile(path.join(dir, META), JSON.stringify(meta, null, 2));
  return (await listCatalog()).find((e) => e.ideaId === ideaId);
}

/** Copies a catalog stay's photos (in their sorted order) and facts into a project. */
export async function applyCatalog(projectId: string, ideaId: string): Promise<Project> {
  const meta = await readMeta(ideaId);
  const idea = findIdea(ideaId);
  if (!meta || !idea) throw new Error("이 숙소는 아직 준비되지 않았어요.");
  const project = await getProject(projectId);
  const slots = Math.max(0, MAX_ASSETS - project.assets.length);
  const saved: Asset[] = [];
  for (const asset of meta.assets.slice(0, slots)) {
    const buffer = await fs.readFile(path.join(dirOf(ideaId), asset.file));
    saved.push({ ...(await saveImageAsset(projectId, buffer, asset.label)), group: asset.group });
  }
  const theme = IDEA_THEMES[idea.theme];
  return updateProject(projectId, (p) => {
    const product = { ...p.product, ...productFromIdea(idea), ...meta.product };
    const assets = [...p.assets, ...saved];
    return {
      ...p,
      title: p.title === "새 여행 숏폼" ? meta.product.name || idea.name : p.title,
      hookAngle: theme.hookAngle,
      product: { ...product, features: featuresFromPhotos(product.features, assets) },
      assets,
    };
  });
}
