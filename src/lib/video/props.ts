import { THEMES } from "../../remotion/theme";
import type { CameraMove, Product, Project, Scene, SceneKind, Style, TemplateId } from "../types";

export const FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
/** Instagram feed carousel, 4:5. */
export const CAROUSEL_WIDTH = 1080;
export const CAROUSEL_HEIGHT = 1350;
export const TRANSITION_FRAMES = 9;

/** Hard-cut templates ("review") have no overlapping transitions. */
export function transitionFramesFor(template: TemplateId): number {
  return THEMES[template].transition === "cut" ? 0 : TRANSITION_FRAMES;
}
/** Silence kept after a narration line so it is not cut by the next transition. */
const NARRATION_TAIL_SEC = 0.35;

/** One cut inside a scene: the photo, plus its AI clip when one was uploaded. */
export type VideoShot = { imageSrc: string; videoSrc: string | null };

export type VideoScene = {
  id: string;
  kind: SceneKind;
  /** Played back to back across the scene; empty means a colour background. */
  shots: VideoShot[];
  caption: string;
  subCaption: string;
  /** Spoken line; subtitle templates show it chunk by chunk. */
  narration: string;
  camera: CameraMove;
  durationInFrames: number;
  audioSrc: string | null;
};

export type VideoProduct = Pick<
  Product,
  "name" | "region" | "priceText" | "originalPriceText" | "rating" | "features"
>;

export type VideoProps = {
  scenes: VideoScene[];
  style: Style;
  product: VideoProduct;
  bgmSrc: string | null;
  logoSrc: string | null;
  /** Every project photo in the user's order; carousel photo slides pick unused ones from here. */
  photos: string[];
};

export type CarouselSlide = { imageSrc: string | null; text: string; variant: "cover" | "text" | "photo" };
export type CarouselProps = VideoProps & { slideIndex: number };

/** Benchmark carousels: a cover, up to three story slides, then photo-only slides (3~6 in total). */
export const CAROUSEL_TEXT_SLIDES = 3;
export const CAROUSEL_MAX_SLIDES = 6;

export function sceneDurationSec(scene: Scene, useAudio: boolean): number {
  const audio = useAudio && scene.audioFile ? (scene.audioDurationSec ?? 0) + NARRATION_TAIL_SEC : 0;
  return Math.max(scene.durationSec, audio);
}

/**
 * Converts a stored project into composition props. `resolveFile` maps a
 * project-relative path (e.g. "assets/a.jpg") to a URL the renderer can load.
 */
export function buildVideoProps(project: Project, resolveFile: (file: string) => string): VideoProps {
  const assetsById = new Map(project.assets.map((a) => [a.id, a]));
  const useAudio = project.voice.provider !== "none";
  const scenes = project.scenes.map<VideoScene>((scene) => {
    const shots = [scene.assetId, ...scene.extraAssetIds].flatMap((assetId) => {
      const asset = assetId ? assetsById.get(assetId) : undefined;
      if (!asset) return [];
      return [{ imageSrc: resolveFile(asset.file), videoSrc: asset.videoFile ? resolveFile(asset.videoFile) : null }];
    });
    return {
      id: scene.id,
      kind: scene.kind,
      shots,
      caption: scene.caption,
      subCaption: scene.subCaption,
      narration: scene.narration,
      camera: scene.camera,
      durationInFrames: Math.round(sceneDurationSec(scene, useAudio) * FPS),
      audioSrc: useAudio && scene.audioFile ? resolveFile(scene.audioFile) : null,
    };
  });
  const { name, region, priceText, originalPriceText, rating, features } = project.product;
  return {
    scenes,
    style: project.style,
    product: { name, region, priceText, originalPriceText, rating, features },
    bgmSrc: project.style.bgmFile ? resolveFile(project.style.bgmFile) : null,
    logoSrc: project.style.logoFile ? resolveFile(project.style.logoFile) : null,
    photos: project.assets.map((a) => resolveFile(a.file)),
  };
}

/** TransitionSeries overlaps neighbours, so each transition shortens the total. */
export function totalDurationInFrames(
  scenes: Pick<VideoScene, "durationInFrames">[],
  transitionFrames = TRANSITION_FRAMES,
): number {
  if (scenes.length === 0) return FPS;
  const sum = scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
  return Math.max(FPS, sum - transitionFrames * (scenes.length - 1));
}

export function videoDurationInFrames(props: Pick<VideoProps, "scenes" | "style">): number {
  return totalDurationInFrames(props.scenes, transitionFramesFor(props.style.template));
}

const TEXT_SLIDE_KINDS = new Set<SceneKind>(["feature", "romance"]);

export function carouselSlides({ scenes, photos }: Pick<VideoProps, "scenes" | "photos">): CarouselSlide[] {
  const hook = scenes.find((s) => s.kind === "hook") ?? scenes[0];
  if (!hook) return [];
  const slides: CarouselSlide[] = [{ imageSrc: hook.shots[0]?.imageSrc ?? null, text: hook.caption, variant: "cover" }];
  for (const scene of scenes) {
    if (slides.length > CAROUSEL_TEXT_SLIDES || !TEXT_SLIDE_KINDS.has(scene.kind) || !scene.shots[0]) continue;
    slides.push({ imageSrc: scene.shots[0].imageSrc, text: scene.caption, variant: "text" });
  }
  const used = new Set(slides.map((s) => s.imageSrc));
  for (const imageSrc of photos) {
    if (slides.length >= CAROUSEL_MAX_SLIDES) break;
    if (used.has(imageSrc)) continue;
    used.add(imageSrc);
    slides.push({ imageSrc, text: "", variant: "photo" });
  }
  return slides;
}

export function formatDuration(frames: number): string {
  return `${(frames / FPS).toFixed(1)}초`;
}
