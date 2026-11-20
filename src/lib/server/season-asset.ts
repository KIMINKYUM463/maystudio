import { promises as fs } from "node:fs";
import path from "node:path";
import { buildSeasonPrompt, resolveSeason } from "../script/season-prompts";
import type { Asset, Project } from "../types";
import { deleteProjectFile, inspectImage } from "./assets";
import { BadRequestError } from "./http";
import {
  createSeasonImagePrediction,
  downloadPredictionFile,
  getPrediction,
  imageDataUri,
  outputFileUrl,
} from "./replicate";
import { getProject, getSettings, newId, projectFilePath, updateProject } from "./store";

export type SeasonStatus = "starting" | "processing" | "succeeded" | "failed";
export type SeasonResult = { project: Project; status: SeasonStatus; error?: string };

function findAsset(project: Project, assetId: string): Asset {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) throw new BadRequestError("사진을 찾을 수 없습니다.");
  return asset;
}

/** The line spoken over this photo, so the season image matches the script's mood. */
function sceneLineFor(project: Project, assetId: string): string {
  const scene = project.scenes.find((s) => s.assetId === assetId || s.extraAssetIds.includes(assetId));
  return scene ? scene.narration || scene.caption : "";
}

async function setJob(id: string, assetId: string, seasonJobId: string | undefined): Promise<Project> {
  return updateProject(id, (p) => ({
    ...p,
    assets: p.assets.map((a) => (a.id === assetId ? { ...a, seasonJobId } : a)),
  }));
}

export async function startSeasonImage(id: string, assetId: string): Promise<SeasonResult> {
  const [project, settings] = await Promise.all([getProject(id), getSettings()]);
  const asset = findAsset(project, assetId);
  if (asset.seasonJobId) return { project, status: "processing" };
  // A clip plays instead of the photo, so a season image under it would never be seen.
  if (asset.videoFile || asset.animateJobId) {
    throw new BadRequestError("이미 AI 영상이 붙은 사진이에요. 영상을 지운 뒤 계절 이미지를 만들어 주세요.");
  }
  const season = resolveSeason(project.style.season);
  // Always repaint from the photo before any earlier season image, so seasons can be switched cleanly.
  const source = asset.preSeasonFile ?? asset.file;
  const bytes = await fs.readFile(projectFilePath(id, source));
  const prediction = await createSeasonImagePrediction(
    settings,
    imageDataUri(bytes, source),
    buildSeasonPrompt(season, sceneLineFor(project, assetId)),
  );
  return { project: await setJob(id, assetId, prediction.id), status: "starting" };
}

/**
 * Swaps the photo for the finished season image. Like AI clips, several pollers may finish the same job:
 * only the one that still sees the job pending attaches; the others delete their copy.
 */
async function attachSeasonImage(id: string, assetId: string, jobId: string, buffer: Buffer): Promise<Project> {
  const { ext, width, height } = inspectImage(buffer);
  const file = path.posix.join("assets", `${assetId}-season-${newId()}.${ext}`);
  const target = projectFilePath(id, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  let replaced: string | undefined;
  let attached = false;
  try {
    const project = await updateProject(id, (p) => {
      const asset = findAsset(p, assetId);
      if (asset.seasonJobId !== jobId) return p;
      attached = true;
      const preSeasonFile = asset.preSeasonFile ?? asset.file;
      // An earlier season image of this photo is dropped; the untouched photo stays as preSeasonFile.
      if (asset.preSeasonFile) replaced = asset.file;
      const season = resolveSeason(p.style.season);
      return {
        ...p,
        assets: p.assets.map((a) =>
          a.id === assetId ? { ...a, file, width, height, season, preSeasonFile, seasonJobId: undefined } : a,
        ),
      };
    });
    if (!attached) await deleteProjectFile(id, file);
    return project;
  } catch (error) {
    await deleteProjectFile(id, file);
    throw error;
  } finally {
    if (replaced && replaced !== file) await deleteProjectFile(id, replaced);
  }
}

export async function pollSeasonImage(id: string, assetId: string): Promise<SeasonResult> {
  const [project, settings] = await Promise.all([getProject(id), getSettings()]);
  const asset = findAsset(project, assetId);
  if (!asset.seasonJobId) {
    if (asset.season) return { project, status: "succeeded" };
    return { project, status: "failed", error: "진행 중인 계절 이미지 작업이 없어요." };
  }
  const prediction = await getPrediction(settings, asset.seasonJobId);
  if (prediction.status === "succeeded") {
    const url = outputFileUrl(prediction.output);
    if (!url) return { project: await setJob(id, assetId, undefined), status: "failed", error: "Replicate가 이미지 주소를 주지 않았어요." };
    const buffer = await downloadPredictionFile(url);
    return { project: await attachSeasonImage(id, assetId, asset.seasonJobId, buffer), status: "succeeded" };
  }
  if (prediction.status === "failed" || prediction.status === "canceled") {
    return {
      project: await setJob(id, assetId, undefined),
      status: "failed",
      error: prediction.error?.trim() || "계절 이미지 생성이 실패했어요.",
    };
  }
  return { project, status: "processing" };
}

/** Puts the original photo back and deletes the season image. */
export async function undoSeasonImage(id: string, assetId: string): Promise<Project> {
  const project = await getProject(id);
  const asset = findAsset(project, assetId);
  if (!asset.preSeasonFile) return project;
  const original = asset.preSeasonFile;
  const { width, height } = inspectImage(await fs.readFile(projectFilePath(id, original)));
  const seasonFile = asset.file;
  const updated = await updateProject(id, (p) => ({
    ...p,
    assets: p.assets.map((a) =>
      a.id === assetId ? { ...a, file: original, width, height, season: undefined, preSeasonFile: undefined } : a,
    ),
  }));
  if (seasonFile !== original) await deleteProjectFile(id, seasonFile);
  return updated;
}
