/**
 * Google Flow (and Kling/Veo) workflow: stills first, then one clip per still.
 * Dropping both together, or dropping clips onto existing photos, must attach
 * the clip to the photo — not create a second still-only card.
 */

export type Named = { name: string; type?: string };
export type PairableAsset = { id: string; file: string; label: string; videoFile?: string };

export type MediaPlan<T extends Named> = {
  /** Same-stem (or same-count) image+clip → one card, image is the poster. */
  pairs: Array<{ image: T; video: T }>;
  /** Clip for a photo already in the project. */
  attach: Array<{ assetId: string; video: T }>;
  images: T[];
  videos: T[];
};

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;
const GENERIC_PREFIX = /^(img|image|photo|pic|dsc|pxl)[-_\s]*/i;
const CLIP_SUFFIX = /[-_\s]*(video|clip|vid|motion|animated|flow|veo|i2v)$/i;

export function isImageFile(file: Named): boolean {
  return file.type?.startsWith("image/") || IMAGE_EXT.test(file.name);
}

export function isVideoFile(file: Named): boolean {
  return file.type?.startsWith("video/") || VIDEO_EXT.test(file.name);
}

/** `온천뷰_video.mp4` and `온천뷰.jpg` share a stem so they become one card. */
export function mediaStem(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "").trim().toLowerCase();
  return base.replace(GENERIC_PREFIX, "").replace(CLIP_SUFFIX, "").replace(/[-_\s().]+/g, "");
}

function take<T>(items: T[], index: number): T {
  return items.splice(index, 1)[0];
}

export function planMediaUpload<T extends Named>(incoming: T[], assets: PairableAsset[]): MediaPlan<T> {
  const images = incoming.filter(isImageFile);
  const videos = incoming.filter(isVideoFile);
  const pairs: MediaPlan<T>["pairs"] = [];
  const attach: MediaPlan<T>["attach"] = [];
  const used = new Set<string>();

  for (const video of [...videos]) {
    const stem = mediaStem(video.name);
    if (!stem) continue;
    const imageIndex = images.findIndex((image) => mediaStem(image.name) === stem);
    if (imageIndex < 0) continue;
    pairs.push({ image: take(images, imageIndex), video });
    used.add(video.name);
  }
  const leftover = videos.filter((v) => !used.has(v.name));

  const stills = () => assets.filter((a) => !a.videoFile && !attach.some((x) => x.assetId === a.id));

  for (const video of [...leftover]) {
    const stem = mediaStem(video.name);
    if (!stem) continue;
    const match = stills().find((a) => mediaStem(a.file) === stem || mediaStem(a.label) === stem);
    if (!match) continue;
    attach.push({ assetId: match.id, video });
    leftover.splice(leftover.indexOf(video), 1);
  }

  // Flow folders often keep the same order but rename clips (`download.mp4`, `download (1).mp4`).
  if (leftover.length && leftover.length === images.length) {
    leftover.forEach((video, i) => pairs.push({ image: images[i], video }));
    images.length = 0;
    leftover.length = 0;
  } else if (leftover.length && images.length === 0) {
    const open = stills();
    const n = Math.min(leftover.length, open.length);
    for (let i = 0; i < n; i++) attach.push({ assetId: open[i].id, video: leftover[i] });
    leftover.splice(0, n);
  }

  return { pairs, attach, images, videos: leftover };
}
