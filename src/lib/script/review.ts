import { HOOK_ANGLES, MAX_SCENE_SHOTS, type Product, type Project, type Scene, type SceneKind } from "../types";
import {
  assignPhotos,
  cameraForAsset,
  generateScript,
  hookVars,
  pick,
  seededRandom,
  shortFeature,
  SHOT_SEC,
  type GeneratedScript,
  type Slot,
} from "./generator";
import { availableHooks, REVIEW_HOOK_LIBRARY } from "./hooks";
import { josa } from "./josa";
import { audienceOf, romanceFor, type Audience } from "./romance";
import { speechSeconds, wrapLines } from "./subtitles";

/**
 * Story beats of the benchmark reels (@heo.jinny.gogo, ~16.5s, one continuous spoken story):
 * ① "사우나를 내방처럼 쓸 수 있는 숙소가 있어요." → ② "여기가 요즘 … 한옥감성 온천호텔인데"
 * → ③ "방안에 사우나에, 대형 욕조까지 있어서 가족들 다같이 몸 지지기 너무 좋더라구요."
 * → ④ "무료 조식도 진짜 맛있고 보드게임도 빌려주니까" → ⑤ "우리끼리 주말 힐링 제대로 하고왔어요."
 */
/** activity: "가족들 다같이 몸 지지기", company: "우리끼리", wish: caption's "뜨끈한 온천 좋아하는 가족이라면". */
export const REVIEW_AUDIENCE: Record<Audience, { activity: string; company: string; wish: string }> = {
  family: { activity: "가족들 다같이 쉬기", company: "가족끼리", wish: "아이랑 갈 숙소 찾는 분이라면" },
  couple: { activity: "둘이 오붓하게 쉬기", company: "둘이서", wish: "둘만의 여행 계획 중이라면" },
  parents: { activity: "부모님 모시고 쉬기", company: "부모님이랑", wish: "부모님 모시고 갈 곳 찾는다면" },
  friends: { activity: "친구들이랑 놀기", company: "친구들이랑", wish: "친구들이랑 놀러 갈 곳 찾는다면" },
  solo: { activity: "혼자 푹 쉬기", company: "혼자", wish: "혼자 조용히 쉬고 싶다면" },
  any: { activity: "푹 쉬다 오기", company: "우리끼리", wish: "제대로 쉬고 싶은 분이라면" },
};
const SELLING_POINTS = 2;
const EXTRAS = 2;

/** Ratings worth bragging about: 4.5+ on a 5-point scale or 9+ on a 10-point one. */
export function braggableRating(rating: string): string | null {
  const value = Number(rating.match(/\d+(?:\.\d+)?/)?.[0]);
  return (value >= 4.5 && value <= 5) || (value >= 9 && value <= 10) ? String(value) : null;
}

/** Beat ②. The benchmark's social proof ("인플루언서들이 전부 다녀갔다는") is only used as facts the listing gives. */
export function proofLine(product: Pick<Product, "rating" | "stayType" | "region" | "occasion">): string {
  const region = product.region.trim().split(/[\s,·]+/).at(-1) ?? "";
  const place = [region, product.stayType.trim() || "숙소"].filter(Boolean).join(" ");
  const rating = braggableRating(product.rating);
  if (rating) return `후기 평점이 ${rating}점이나 되는 ${place}인데`;
  if (product.occasion.trim()) return `${product.occasion.trim()} 가기 딱 좋은 ${place}인데`;
  return `여기가 바로 ${place}인데`;
}

/** Beat ③: the two selling points and what they are good for; first-person only for visited stays. */
export function pointsLine(points: string[], audience: Audience, visited: boolean): string {
  const [a, b] = points;
  const has = b ? `${a}에, ${b}까지 있어서` : a ? `${josa(a, "이")} 있어서` : "구석구석 깔끔해서";
  return `${has} ${REVIEW_AUDIENCE[audience].activity} ${visited ? "너무 좋더라구요." : "딱 좋아요."}`;
}

/** Beat ④: the 덤 ("무료 조식도 …, 보드게임도 …"); falls back to the FAB romance line. */
export function extrasLine(extras: string[], product: Pick<Product, "features" | "target">): string {
  const [c, d] = extras;
  if (c && d) return `${c}도 있고 ${d}까지 있으니까`;
  if (c) return `${c}까지 있으니까`;
  return romanceFor(product).narration;
}

export function closingLine(audience: Audience, season: string, visited: boolean): string {
  return visited ? `${REVIEW_AUDIENCE[audience].company} ${season} 힐링 제대로 하고왔어요.` : `이번 ${season}, 여기서 제대로 힐링해보세요.`;
}

type Beat = { kind: SceneKind; id: string; match: string; narration: string; caption?: string };

export function generateReviewScript(
  project: Pick<Project, "product" | "assets" | "hookAngle">,
  seed = Date.now(),
  now = new Date(),
): GeneratedScript {
  const rand = seededRandom(seed);
  const { product, assets } = project;
  const vars = hookVars(product, now);
  const preferred = availableHooks(project.hookAngle, vars, REVIEW_HOOK_LIBRARY);
  const hook = pick(
    preferred.length ? preferred : HOOK_ANGLES.flatMap((angle) => availableHooks(angle, vars, REVIEW_HOOK_LIBRARY)),
    rand,
  );
  const features = product.features.map(shortFeature).filter(Boolean);
  const points = features.slice(0, SELLING_POINTS);
  const extras = features.slice(SELLING_POINTS, SELLING_POINTS + EXTRAS);
  const audience = audienceOf(product.target);

  const beats: Beat[] = [
    { kind: "hook", id: "hook", match: "", narration: hook.narration, caption: hook.caption },
    { kind: "feature", id: "proof", match: "", narration: proofLine(product) },
    { kind: "feature", id: "points", match: points[0] ?? "", narration: pointsLine(points, audience, product.visited) },
    { kind: "romance", id: "extras", match: extras[0] ?? "", narration: extrasLine(extras, product) },
    { kind: "outro", id: "closing", match: "", narration: closingLine(audience, vars.season ?? "겨울", product.visited) },
  ];
  // Benchmark cuts every ~1.1s; extra photos are left for the carousel instead of shortening cuts.
  const slots: Slot[] = beats.map((b) => ({
    kind: b.kind,
    id: b.id,
    match: b.match,
    capacity: Math.min(MAX_SCENE_SHOTS, Math.max(1, Math.round(speechSeconds(b.narration) / SHOT_SEC))),
  }));
  const photos = assignPhotos(assets, slots, false);
  const assetsById = new Map(assets.map((a) => [a.id, a]));

  const scenes = beats.map<Scene>((beat, index) => {
    const [first = null, ...rest] = photos.get(beat.id) ?? [];
    return {
      id: beat.id,
      kind: beat.kind,
      assetId: first,
      extraAssetIds: rest,
      // Shown on the cover / carousel slides; the reel itself shows the narration as subtitles.
      caption: (beat.caption ?? wrapLines(beat.narration)).slice(0, 60),
      subCaption: "",
      narration: beat.narration,
      camera: cameraForAsset(first ? assetsById.get(first) : undefined, index),
      durationSec: speechSeconds(beat.narration),
    };
  });
  return { scenes };
}

/** Script generator for the project's template. */
export function scriptFor(
  project: Pick<Project, "product" | "assets" | "hookAngle" | "copy" | "style">,
  seed = Date.now(),
  now = new Date(),
): GeneratedScript {
  return project.style.template === "review" ? generateReviewScript(project, seed, now) : generateScript(project, seed, now);
}
