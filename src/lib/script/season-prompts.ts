import type { Season } from "../types";

export type ConcreteSeason = Exclude<Season, "auto">;

export const SEASON_LABELS: Record<ConcreteSeason, string> = {
  spring: "봄",
  summer: "여름",
  autumn: "가을",
  winter: "겨울",
};

/** "auto" → the season of `now` in Korea (Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter). */
export function resolveSeason(season: Season, now = new Date()): ConcreteSeason {
  if (season !== "auto") return season;
  const month = now.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

const SEASON_LOOKS: Record<ConcreteSeason, string> = {
  spring:
    "spring: the existing trees show soft pink blossoms and fresh light-green leaves, gentle morning sunlight, clean airy colors",
  summer:
    "summer: the existing trees are lush deep green, clear blue sky with a few white clouds, crisp bright sunlight",
  autumn:
    "autumn: the existing trees and plants turn red, orange and yellow, warm late-afternoon sunlight with natural true-to-life colors (no orange filter, the sky stays a real sky)",
  winter:
    "winter: light fresh snow on roofs, existing trees and open ground, soft cold daylight, warm lights inside, a cozy mood",
};

/**
 * Instruction for an image-edit model (nano-banana): repaint the season, keep the place exactly as it is.
 * The scene line only sets the mood; it must never add buildings, signs or objects the stay does not have.
 */
export function buildSeasonPrompt(season: ConcreteSeason, sceneLine = ""): string {
  const line = sceneLine.trim().slice(0, 120);
  return [
    "Edit this travel accommodation photo into a vertical 9:16 photorealistic Instagram Reels frame.",
    `Season: ${SEASON_LOOKS[season]}.`,
    "Keep the place exactly the same: same building, room layout, furniture, windows, materials and camera angle. Do not add or remove architecture, furniture, signs or objects.",
    // A first test turned a ski slope into rice paddies; the stay's surroundings must never be invented.
    "Keep the surrounding landscape the same too: same mountains, slopes, sea, lawns and terrain. Do not add fields, crops, water or plants that are not in the photo; only recolor what is there.",
    "Extend the frame naturally to fill 9:16 by continuing what is already at the edges. Natural lighting, sharp detail, like a real photo taken on a phone. No text, no logos, no watermarks, no borders, no visible faces.",
    line ? `The reel line over this shot (mood only, do not write it): "${line}".` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
