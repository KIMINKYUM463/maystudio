import type { Project, ProjectPatch, Scene } from "./types";

/** Reorders/relabels existing assets; unknown ids are ignored and omitted assets are kept at the end. */
function mergeAssets(current: Project["assets"], patch: NonNullable<ProjectPatch["assets"]>): Project["assets"] {
  const byId = new Map(current.map((a) => [a.id, a]));
  const ordered = patch.flatMap((p) => {
    const asset = byId.get(p.id);
    if (!asset) return [];
    byId.delete(p.id);
    return [{ ...asset, label: p.label ?? asset.label }];
  });
  return [...ordered, ...byId.values()];
}

/**
 * Client-sent audio paths are never trusted: a scene keeps its narration clip
 * only if the stored scene with the same id still has identical narration text.
 */
function mergeScenes(current: Scene[], next: Scene[], assetIds: Set<string>): Scene[] {
  const previous = new Map(current.map((s) => [s.id, s]));
  return next.map((scene) => {
    const prev = previous.get(scene.id);
    const keepAudio = prev?.audioFile && prev.narration === scene.narration;
    return {
      ...scene,
      assetId: scene.assetId && assetIds.has(scene.assetId) ? scene.assetId : null,
      extraAssetIds: scene.extraAssetIds.filter((id) => assetIds.has(id)),
      audioFile: keepAudio ? prev.audioFile : undefined,
      audioDurationSec: keepAudio ? prev.audioDurationSec : undefined,
    };
  });
}

export function applyProjectPatch(project: Project, patch: ProjectPatch): Project {
  const assets = patch.assets ? mergeAssets(project.assets, patch.assets) : project.assets;
  const assetIds = new Set(assets.map((a) => a.id));
  const scenes = patch.scenes ? mergeScenes(project.scenes, patch.scenes, assetIds) : project.scenes;
  return {
    ...project,
    title: patch.title ?? project.title,
    hookAngle: patch.hookAngle ?? project.hookAngle,
    product: { ...project.product, ...patch.product },
    style: { ...project.style, ...patch.style },
    voice: { ...project.voice, ...patch.voice },
    copy: { ...project.copy, ...patch.copy },
    stats: { ...project.stats, ...patch.stats },
    assets,
    scenes,
    status: project.status === "draft" && scenes.length > 0 ? "scripted" : project.status,
  };
}
