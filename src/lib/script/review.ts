import { HOOK_ANGLES, MAX_SCENE_SHOTS, type Product, type Project, type Scene, type SceneKind } from "../types";
import {
  assignPhotos,
  cameraForAsset,
  dedupeFeatures,
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
import { isGenericLabel } from "../photo-groups";
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
export function proofLine(product: Pick<Product, "rating" | "stayType" | "region" | "occasion" | "visited">): string {
  const region = product.region.trim().split(/[\s,·]+/).at(-1) ?? "";
  const place = [region, product.stayType.trim() || "숙소"].filter(Boolean).join(" ");
  // Not visited: instead of the same "평점 9.x" line every time, say why the hook is true (rating stays in the caption).
  if (!product.visited) return `${region || "국내"}에 이런 ${josa(product.stayType.trim() || "숙소", "이")} 숨어 있었어요,`;
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

/** Benchmark (런비) closes on urgency + save ("방 다 차기 전에 무조건 저장부터 해 두세요"). */
/** Rotated so a channel's reels don't all end on the same sentence. */
const CLOSINGS = [
  (season: string) => `${season} 방 다 차기 전에 꼭 저장해두세요.`,
  (season: string) => `올${season} 여기 하나만 저장해두세요.`,
  () => `주말 방 다 차기 전에 꼭 저장해두세요.`,
];

export function closingLine(audience: Audience, season: string, visited: boolean, variant = 0): string {
  return visited
    ? `${REVIEW_AUDIENCE[audience].company} ${season} 힐링 제대로 하고왔어요.`
    : CLOSINGS[variant % CLOSINGS.length](season);
}

/** Water facilities sell stays (런비: "물놀이 시설이 있는 숙소가 돈 되는 숙소"); they open the reel. */
export const WATER_PATTERN = /수영장|풀|스파|자쿠지|온천|노천|욕조|히노끼|사우나|워터/;

/** Beat "kicker": the benchmark saves its strongest point for "심지어 노천탕은 오션뷰에". */
export function kickerLine(feature: string, visited: boolean): string {
  return visited ? `심지어 ${josa(feature, "까지")} 있더라구요.` : `심지어 ${josa(feature, "까지")} 있다니까요.`;
}

/** Photos fit for the reel: AI-flagged "other" shots (cars, signs, lobbies) only when too few remain. */
export function reelAssets<T extends { group?: string }>(assets: T[]): T[] {
  const usable = assets.filter((a) => a.group !== "other");
  return usable.length >= 5 ? usable : assets;
}

/** Puts the first water-facility photo first so it lands on the hook (and the cover). */
export function waterFirst<T extends { label: string }>(assets: T[]): T[] {
  const index = assets.findIndex((a) => WATER_PATTERN.test(a.label));
  return index > 0 ? [assets[index], ...assets.slice(0, index), ...assets.slice(index + 1)] : assets;
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
  const features = dedupeFeatures(product.features.map(shortFeature).filter(Boolean));
  const points = features.slice(0, SELLING_POINTS);
  const extras = features.slice(SELLING_POINTS, SELLING_POINTS + EXTRAS);
  // The 5th fact becomes the "심지어" beat; prefer a water facility since it is the strongest pull.
  const rest = features.slice(SELLING_POINTS + EXTRAS);
  // Benchmark reels always save one strongest point for "심지어"; with few facts it comes from the extras,
  // and with only two facts the second selling point moves there.
  const kicker =
    rest.find((f) => WATER_PATTERN.test(f)) ??
    rest[0] ??
    (extras.length ? extras.pop() : features.length >= 2 ? points.pop() : undefined);
  const audience = audienceOf(product.target);

  const beats: Beat[] = [
    { kind: "hook", id: "hook", match: "", narration: hook.narration, caption: hook.caption },
    { kind: "feature", id: "proof", match: "", narration: proofLine(product) },
    { kind: "feature", id: "points", match: points[0] ?? "", narration: pointsLine(points, audience, product.visited) },
    { kind: "romance", id: "extras", match: extras[0] ?? "", narration: extrasLine(extras, product) },
    ...(kicker ? [{ kind: "romance" as const, id: "kicker", match: kicker, narration: kickerLine(kicker, product.visited) }] : []),
    { kind: "outro", id: "closing", match: "", narration: closingLine(audience, vars.season ?? "겨울", product.visited, Math.floor(rand() * 3)) },
  ];
  // Benchmark cuts every ~1.1s; extra photos are left for the carousel instead of shortening cuts.
  const slots: Slot[] = beats.map((b) => ({
    kind: b.kind,
    id: b.id,
    match: b.match,
    capacity: Math.min(MAX_SCENE_SHOTS, Math.max(1, Math.round(speechSeconds(b.narration) / SHOT_SEC))),
  }));
  const photos = assignPhotos(waterFirst(reelAssets(assets)), slots, false);
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

/**
 * How strongly a photo's name shows up in a line ("야외수영장" ↔ "…수영장에서…" = 3): the longest run of
 * characters both share. Generic names ("객실", "대표 사진") never match.
 */
export function narrationMatchScore(narration: string, label: string): number {
  if (isGenericLabel(label)) return 0;
  const a = narration.replace(/\s/g, "");
  const b = label.replace(/\s/g, "");
  let best = 0;
  for (let i = 0; i < b.length; i++)
    for (let j = i + best + 1; j <= b.length && a.includes(b.slice(i, j)); j++) best = j - i;
  return best >= 2 ? best : 0;
}

/** Best-matching photo for a line among the candidates, or null when none is named in it. */
function bestMatch<T extends { id: string; label: string }>(narration: string, candidates: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const asset of candidates) {
    const score = narrationMatchScore(narration, asset.label);
    if (score > bestScore) [best, bestScore] = [asset, score];
  }
  return best;
}

/**
 * After an AI rewrite changes narration lengths: re-time each scene to its speech and re-deal the
 * quick cuts so footage still changes every ~SHOT_SEC. A line that names a facility ("스케이트장")
 * gets that photo first; the hook keeps its photo since it is also the cover.
 */
export function refitReviewShots(scenes: Scene[], assets: Project["assets"]): Scene[] {
  const ordered = waterFirst(reelAssets(assets));
  const order = ordered.map((a) => a.id);
  // Hook photo first (it is the cover), then lines that name a photo claim it, then the rest keep theirs.
  const firsts: (string | null)[] = scenes.map((s) => (s.kind === "hook" ? s.assetId : null));
  const taken = new Set(firsts.filter((id): id is string => Boolean(id)));
  // A line naming one facility ("심지어 바비큐는…") picks before a quick list ("수영장, 바비큐도") that has other options.
  const named = (narration: string) => ordered.filter((a) => narrationMatchScore(narration, a.label) > 0).length;
  scenes
    .map((scene, i) => ({ scene, i, n: named(scene.narration) }))
    .filter(({ scene, n }) => scene.kind !== "hook" && n > 0)
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .forEach(({ scene, i }) => {
      const matched = bestMatch(scene.narration, ordered.filter((a) => !taken.has(a.id)));
      if (matched) taken.add((firsts[i] = matched.id));
    });
  scenes.forEach((scene, i) => {
    if (firsts[i] || scene.kind === "hook") return;
    const free = ordered.find((a) => !taken.has(a.id))?.id;
    const first = scene.assetId && !taken.has(scene.assetId) ? scene.assetId : (free ?? scene.assetId);
    if (first) taken.add(first);
    firsts[i] = first;
  });
  const pool = ordered.filter((a) => !taken.has(a.id));
  // Once fresh photos run out, photos are reused in order (never the same one twice in a row)
  // so footage keeps changing every ~SHOT_SEC instead of one photo holding for 4+ seconds.
  let reuse = 0;
  const next = (avoid: string | null, narration: string, group: string | undefined): string | null => {
    // Named photo first, then one from the same group (a water line keeps showing water, not the parking lot).
    const pick = bestMatch(narration, pool) ?? (group ? pool.find((a) => a.group === group) : undefined) ?? pool[0];
    if (pick) return pool.splice(pool.indexOf(pick), 1)[0].id;
    for (let tries = 0; tries < order.length; tries++) {
      const id = order[reuse++ % order.length];
      if (id !== avoid) return id;
    }
    return null;
  };
  // Design review: repeating photos looks worse than slightly longer cuts. When fresh photos cover
  // under 60% of the cuts needed, cuts stretch to ~1.4s before any photo comes back.
  const needed = scenes.reduce((sum, s) => sum + Math.max(1, Math.round(speechSeconds(s.narration) / SHOT_SEC)), 0);
  const shotSec = order.length < needed * 0.6 ? 1.4 : SHOT_SEC;
  const byId = new Map(assets.map((a) => [a.id, a]));
  return scenes.map((scene, index) => {
    const durationSec = speechSeconds(scene.narration);
    const cuts = Math.min(MAX_SCENE_SHOTS, Math.max(1, Math.round(durationSec / shotSec)));
    const assetId = firsts[index];
    const extra: string[] = [];
    let previous = assetId;
    const group = assetId ? byId.get(assetId)?.group : undefined;
    for (let i = 1; i < cuts; i++) {
      const id = next(previous, scene.narration, group);
      if (!id) break;
      extra.push(id);
      previous = id;
    }
    const camera = assetId === scene.assetId ? scene.camera : cameraForAsset(assetId ? byId.get(assetId) : undefined, index);
    return { ...scene, assetId, camera, durationSec, extraAssetIds: extra };
  });
}

/** Script generator for the project's template. */
export function scriptFor(
  project: Pick<Project, "product" | "assets" | "hookAngle" | "copy" | "style">,
  seed = Date.now(),
  now = new Date(),
): GeneratedScript {
  return project.style.template === "review" ? generateReviewScript(project, seed, now) : generateScript(project, seed, now);
}
