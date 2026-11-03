import { promises as fs } from "node:fs";
import { buildVideoPrompt, detectPromptType, labelHasPeople, type PromptTypeId } from "../script/video-prompts";
import type { Project } from "../types";
import { deleteProjectFile, saveVideoClip } from "./assets";
import { BadRequestError } from "./http";
import {
  createI2vPrediction,
  downloadPredictionFile,
  getPrediction,
  imageDataUri,
  outputFileUrl,
} from "./replicate";
import { getProject, getSettings, projectFilePath, updateProject } from "./store";

const PROMPT_TYPE_IDS = new Set<string>(["hotspring", "pool", "night", "fire", "kiln", "food", "interior", "view", "nature"]);

export type AnimateStatus = "starting" | "processing" | "succeeded" | "failed";
export type AnimateResult = { project: Project; status: AnimateStatus; error?: string };

async function setJob(id: string, assetId: string, animateJobId: string | undefined): Promise<Project> {
  return updateProject(id, (p) => ({
    ...p,
    assets: p.assets.map((a) => (a.id === assetId ? { ...a, animateJobId } : a)),
  }));
}

async function attachClip(id: string, assetId: string, buffer: Buffer): Promise<Project> {
  const videoFile = await saveVideoClip(id, assetId, buffer);
  let previous: string | undefined;
  try {
    return await updateProject(id, (p) => {
      const asset = p.assets.find((a) => a.id === assetId);
      if (!asset) throw new BadRequestError("사진을 찾을 수 없습니다.");
      previous = asset.videoFile;
      return { ...p, assets: p.assets.map((a) => (a.id === assetId ? { ...a, videoFile, animateJobId: undefined } : a)) };
    });
  } catch (error) {
    await deleteProjectFile(id, videoFile);
    throw error;
  } finally {
    if (previous && previous !== videoFile) await deleteProjectFile(id, previous);
  }
}

export async function startAssetAnimate(
  id: string,
  assetId: string,
  options: { promptType?: string; withPeople?: boolean } = {},
): Promise<AnimateResult> {
  const [project, settings] = await Promise.all([getProject(id), getSettings()]);
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) throw new BadRequestError("사진을 찾을 수 없습니다.");
  if (asset.animateJobId) return { project, status: "processing" };
  const type = PROMPT_TYPE_IDS.has(options.promptType ?? "") ? (options.promptType as PromptTypeId) : detectPromptType(asset.label);
  const prompt = buildVideoPrompt(type, options.withPeople ?? labelHasPeople(asset.label));
  const bytes = await fs.readFile(projectFilePath(id, asset.file));
  const prediction = await createI2vPrediction(settings, imageDataUri(bytes, asset.file), prompt);
  return { project: await setJob(id, assetId, prediction.id), status: "starting" };
}

export async function pollAssetAnimate(id: string, assetId: string): Promise<AnimateResult> {
  const [project, settings] = await Promise.all([getProject(id), getSettings()]);
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) throw new BadRequestError("사진을 찾을 수 없습니다.");
  if (!asset.animateJobId) {
    if (asset.videoFile) return { project, status: "succeeded" };
    return { project, status: "failed", error: "진행 중인 영상 작업이 없어요." };
  }
  const prediction = await getPrediction(settings, asset.animateJobId);
  if (prediction.status === "succeeded") {
    const url = outputFileUrl(prediction.output);
    if (!url) return { project: await setJob(id, assetId, undefined), status: "failed", error: "Replicate가 영상 주소를 주지 않았어요." };
    return { project: await attachClip(id, assetId, await downloadPredictionFile(url)), status: "succeeded" };
  }
  if (prediction.status === "failed" || prediction.status === "canceled") {
    return {
      project: await setJob(id, assetId, undefined),
      status: "failed",
      error: prediction.error?.trim() || "Replicate 영상 생성이 실패했어요.",
    };
  }
  return { project, status: "processing" };
}
