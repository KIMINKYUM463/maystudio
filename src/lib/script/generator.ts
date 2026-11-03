import { HOOK_ANGLES, MAX_SCENE_SHOTS } from "../types";
import type { Asset, CameraMove, HookAngle, Product, Project, Scene, SceneKind, Style, TemplateId } from "../types";
import { availableHooks, hookLibraryFor, type HookVars } from "./hooks";
import { audienceOf, romanceFor, type Audience } from "./romance";
import { speechSeconds } from "./subtitles";

export const SCENE_DURATIONS = {
  hook: 2.8,
  feature: 3.2,
  romance: 4.4,
  outro: 3.4,
  info: 2.8,
  cta: 3,
} as const satisfies Record<SceneKind, number>;
/** Kit: photos are cut every 1~1.5s under the narration. */
export const SHOT_SEC = 1.1;
/** Kit rule 2: one or two selling points only; listing every facility turns a reel into a notice. */
export const MAX_SELLING_POINTS = 2;
const MAX_OUTRO_EXTRAS = 3;

/** Small deterministic PRNG so the same seed always yields the same script. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

/** "1박 89,000원~" → "1박 8만원대", keeps non-numeric text as-is. */
export function shortPrice(priceText: string, category: Product["category"] = "stay"): string {
  const text = priceText.trim();
  // Take the largest number so "1박 89,000원" reads 89,000 rather than 189,000.
  const numbers = (text.match(/\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/,/g, "")));
  if (!numbers.length) return text;
  const value = Math.max(...numbers);
  if (!Number.isFinite(value) || value < 10_000) return text;
  const man = Math.floor(value / 10_000);
  const perNight = category === "stay" || /박/.test(text) ? "1박 " : "";
  return `${perNight}${man}만원대`;
}

const LABEL_CAPTIONS: Array<[RegExp, string[]]> = [
  [/온천|노천|사우나|찜질|탕/, ["김 오르는 노천탕", "몸이 녹는 온천", "뜨끈한 물 한가득"]],
  [/한옥|온돌|마루/, ["고요한 한옥 마당", "뜨끈한 온돌방"]],
  [/뷰|view|전망|오션|바다|풍경/i, ["창밖이 그냥 그림", "뷰 하나로 끝", "이 뷰 실화인가요"]],
  [/수영장|풀|pool/i, ["수영장까지 있는 곳", "물멍 가능한 수영장", "하루 종일 물놀이"]],
  [/욕실|화장실|욕조|bath|스파|자쿠지/i, ["욕실도 호텔급", "반신욕 가능한 욕조", "스파 같은 욕실"]],
  [/객실|침실|방|room|bed|침대/i, ["넓고 깔끔한 객실", "침구까지 완벽", "아늑한 침실"]],
  [/외관|건물|입구|전경|exterior/i, ["도착하자마자 감탄", "외관부터 남다름"]],
  [/로비|라운지|lobby/i, ["로비부터 분위기 압도", "라운지에서 여유 한 잔"]],
  [/조식|식사|레스토랑|breakfast/i, ["조식 맛집 인정", "아침이 기다려지는 조식"]],
  [/테라스|발코니|마당|정원/, ["테라스에서 커피 한 잔", "나만의 정원"]],
  [/바베큐|바비큐|bbq|그릴/i, ["저녁엔 바베큐 파티", "바베큐 세팅 완료"]],
  [/불멍|캠프파이어|벽난로/, ["밤에는 불멍 타임", "벽난로 앞 힐링"]],
];

const GENERIC_CAPTIONS = ["디테일까지 완벽", "감성 가득한 공간", "하루 종일 머물고 싶은", "구석구석 예쁜 곳"];

function captionForAsset(asset: Asset | undefined, rand: () => number): string {
  const label = asset?.label ?? "";
  const match = LABEL_CAPTIONS.find(([pattern]) => pattern.test(label));
  return pick(match ? match[1] : GENERIC_CAPTIONS, rand);
}

export function cameraForAsset(asset: Asset | undefined, index: number): CameraMove {
  if (asset?.width && asset.height) {
    const ratio = asset.width / asset.height;
    if (ratio > 1.2) return index % 2 === 0 ? "pan-right" : "pan-left";
    if (ratio < 0.8) return index % 2 === 0 ? "tilt-up" : "push-in";
  }
  const cycle: CameraMove[] = ["push-in", "drift", "pull-out", "pan-right"];
  return cycle[index % cycle.length];
}

export function defaultAngleForTemplate(template: TemplateId): HookAngle {
  if (template === "deal") return "price";
  if (template === "luxury") return "contrast";
  return "condition";
}

/** "강원 강릉" → "강릉": hooks read better with the most specific place name. */
export function shortRegion(region: string): string {
  return region.trim().split(/[\s,·]+/).filter(Boolean).at(-1) ?? "";
}

/** "온천/스파/사우나" → "온천", "노천탕 (객실 전용)" → "노천탕": facility lists read badly in a hook. */
export function shortFeature(feature: string | undefined): string {
  return (feature ?? "").split(/[/(]/)[0].trim();
}

const SEASONS = ["겨울", "겨울", "봄", "봄", "봄", "여름", "여름", "여름", "가을", "가을", "가을", "겨울"] as const;

/**
 * Season a reel should talk about, looking a month ahead: the kit uploads winter stays
 * from November so they are already stacked up when people start searching.
 */
export function seasonOf(now: Date): string {
  const ahead = new Date(now.getTime() + 30 * 86_400_000);
  return SEASONS[ahead.getMonth()];
}

/**
 * Matches when a feature and a photo label share a meaningful word ("통창 오션뷰" ↔ "오션뷰")
 * or describe the same kind of space ("스파 욕조" ↔ "욕실").
 */
export function featureMatchesLabel(feature: string, label: string): boolean {
  const words = (s: string) => s.toLowerCase().split(/[\s,·/]+/).filter((w) => w.length >= 2);
  const labelWords = words(label);
  if (words(feature).some((fw) => labelWords.some((lw) => fw.includes(lw) || lw.includes(fw)))) return true;
  return Boolean(label.trim()) && LABEL_CAPTIONS.some(([pattern]) => pattern.test(feature) && pattern.test(label));
}

export function hookVars(product: Product, now = new Date()): HookVars {
  return {
    region: shortRegion(product.region),
    price: shortPrice(product.priceText, product.category),
    feature: shortFeature(product.features.find((f) => f.trim())),
    // "커플, 친구" → "커플": a list doesn't fit "{target}이랑".
    target: product.target.split(/[,·/]/)[0].trim(),
    stayType: product.stayType,
    access: product.access,
    occasion: product.occasion,
    season: seasonOf(now),
  };
}

export function featureNarration(caption: string): string {
  const clean = caption.replace(/\n/g, " ").trim();
  return /[.!?요다]$/.test(clean) ? clean : `${clean}.`;
}

/** Kit: end with one short comment keyword ("정보는 '쉼' 남겨주세요"); DM automation matches it. */
export function ctaCaption(keyword: string): string {
  return `정보는 댓글에\n'${keyword}' 남겨주세요`;
}

const OUTRO_CLOSINGS: Record<Audience, (season: string) => string> = {
  family: (s) => `올${s}엔\n아이랑 여기서 추억 하나`,
  couple: (s) => `올${s}엔\n둘이 여기서 쉬어가요`,
  parents: (s) => `올${s}엔\n부모님 모시고 여기`,
  friends: (s) => `올${s}엔\n친구들이랑 여기`,
  solo: (s) => `올${s}엔\n나를 위한 하루`,
  any: (s) => `올${s}엔\n여기서 푹 쉬어가요`,
};

/** A scene waiting for photos: `match` is the feature its photo should show, `capacity` its natural cut count. */
export type Slot = { kind: SceneKind; id: string; match: string; capacity: number };

function shotCount(kind: SceneKind): number {
  // The hook stays on the single most romantic photo (kit rule 3) and doubles as the cover.
  if (kind === "hook" || kind === "cta") return 1;
  return Math.min(MAX_SCENE_SHOTS, Math.max(1, Math.round(SCENE_DURATIONS[kind] / SHOT_SEC)));
}

/**
 * Hands out photos in the user's order: the first photo opens the hook, scenes then claim the
 * photo whose label matches their feature, empty scenes take the next leftover, and the rest
 * are dealt round-robin as quick cuts.
 */
export function assignPhotos(assets: Asset[], slots: Slot[], useAll = true): Map<string, string[]> {
  const shots = new Map<string, string[]>(slots.map((s) => [s.id, []]));
  if (assets.length === 0) return shots;
  const pool = [...assets];
  const listOf = (slot: Slot) => shots.get(slot.id)!;
  const give = (slot: Slot, index: number) => listOf(slot).push(pool.splice(index, 1)[0].id);
  const matchIndex = (slot: Slot) => (slot.match ? pool.findIndex((a) => featureMatchesLabel(slot.match, a.label)) : -1);

  for (const slot of slots) if (slot.kind === "hook" && pool.length) give(slot, 0);
  // Matches are claimed before any scene takes leftovers (regression: 바베큐 caption on the 오션뷰 photo).
  for (const slot of slots) {
    const index = matchIndex(slot);
    if (index >= 0 && listOf(slot).length === 0) give(slot, index);
  }
  for (const slot of slots) if (pool.length && listOf(slot).length === 0) give(slot, 0);
  // Fill to the natural cut count first, then (useAll) let multi-shot scenes grow so all 15~20 photos are used.
  const capacities = [(s: Slot) => s.capacity, (s: Slot) => (s.capacity > 1 ? MAX_SCENE_SHOTS : 1)];
  for (const capacity of useAll ? capacities : capacities.slice(0, 1)) {
    for (let added = true; added && pool.length; ) {
      added = false;
      for (const slot of slots) {
        if (!pool.length || listOf(slot).length >= capacity(slot)) continue;
        give(slot, Math.max(0, matchIndex(slot)));
        added = true;
      }
    }
  }
  // Fewer photos than scenes: reuse them in order rather than showing a blank background.
  slots.forEach((slot, i) => {
    const list = shots.get(slot.id)!;
    if (list.length === 0) list.push(assets[i % assets.length].id);
  });
  return shots;
}

export type GeneratedScript = { scenes: Scene[] };

/**
 * Rule-based script following the kit's five beats:
 * 후킹(0~2s) → 소구점 1~2개 → 로망(FAB, one line) → 덤·여운 → 댓글 키워드 CTA.
 */
export function generateScript(
  project: Pick<Project, "product" | "assets" | "hookAngle" | "copy" | "style">,
  seed = Date.now(),
  now = new Date(),
): GeneratedScript {
  const rand = seededRandom(seed);
  const { product, assets } = project;
  const vars = hookVars(product, now);
  const preferred = availableHooks(project.hookAngle, vars);
  const hook = pick(
    preferred.length ? preferred : HOOK_ANGLES.flatMap((angle) => availableHooks(angle, vars)),
    rand,
  );

  const features = product.features.map((f) => f.trim()).filter(Boolean);
  const sellingPoints = features.slice(0, MAX_SELLING_POINTS);
  const extras = features.slice(MAX_SELLING_POINTS, MAX_SELLING_POINTS + MAX_OUTRO_EXTRAS).map(shortFeature);
  const romance = romanceFor(product);
  const keyword = project.copy.commentKeyword || "숙소";

  const featureSlots = (sellingPoints.length ? sellingPoints : [""]).map((feature, i) => ({
    kind: "feature" as const,
    id: `feature-${i + 1}`,
    match: feature,
  }));
  const slots: Slot[] = [
    { kind: "hook" as const, id: "hook", match: "" },
    ...featureSlots,
    { kind: "romance" as const, id: "romance", match: romance.feature },
    { kind: "outro" as const, id: "outro", match: "" },
    { kind: "cta" as const, id: "cta", match: "" },
  ].map((s) => ({ ...s, capacity: shotCount(s.kind) }));
  const photos = assignPhotos(assets, slots);
  const assetsById = new Map(assets.map((a) => [a.id, a]));

  const sceneBase = (slot: Slot, index: number): Pick<Scene, "id" | "kind" | "assetId" | "extraAssetIds" | "camera" | "durationSec"> => {
    const [first = null, ...rest] = photos.get(slot.id) ?? [];
    return {
      id: slot.id,
      kind: slot.kind,
      assetId: first,
      extraAssetIds: rest,
      camera: cameraForAsset(first ? assetsById.get(first) : undefined, index),
      // A scene that received extra cuts grows so each cut still lasts about SHOT_SEC.
      durationSec: Math.max(SCENE_DURATIONS[slot.kind], Math.round((1 + rest.length) * SHOT_SEC * 10) / 10),
    };
  };

  const regionLine = [product.region && `📍 ${product.region}`, project.style.showName && product.name]
    .filter(Boolean)
    .join(" · ");
  const closing = OUTRO_CLOSINGS[audienceOf(product.target)](vars.season ?? "겨울");

  const scenes: Scene[] = slots.map((slot, index) => {
    const base = sceneBase(slot, index);
    switch (slot.kind) {
      case "hook":
        return { ...base, camera: "push-in", caption: hook.caption, subCaption: regionLine, narration: hook.narration };
      case "feature": {
        const caption = slot.match || captionForAsset(base.assetId ? assetsById.get(base.assetId) : undefined, rand);
        return { ...base, caption, subCaption: "", narration: featureNarration(caption) };
      }
      case "romance":
        return { ...base, caption: romance.caption, subCaption: "", narration: romance.narration };
      case "outro":
        return {
          ...base,
          caption: closing,
          subCaption: extras.length ? `+ ${extras.join(" · ")}` : "",
          narration: `${extras.length ? `덤으로 ${extras.join(", ")}까지 있어요. ` : ""}${featureNarration(closing)}`,
        };
      default:
        return {
          ...base,
          camera: "pull-out",
          caption: ctaCaption(keyword),
          subCaption: "DM으로 바로 보내드려요",
          narration: `숙소 정보는 댓글에 ${keyword} 남겨주세요.`,
        };
    }
  });

  return { scenes };
}

/**
 * Kit test "같은 숙소, 첫 문장만 바꿔서 다시 올려 보세요": keeps every scene but the hook,
 * which moves to the next angle that yields a different line. The hook's narration audio is
 * dropped because its text changed.
 */
export function swapHook(
  project: Pick<Project, "product" | "hookAngle" | "scenes"> & { style?: Pick<Style, "template"> },
  seed = Date.now(),
  now = new Date(),
): Pick<Project, "hookAngle" | "scenes"> {
  const rand = seededRandom(seed);
  const vars = hookVars(project.product, now);
  const library = hookLibraryFor(project.style?.template ?? "emotional");
  const current = project.scenes.find((s) => s.kind === "hook");
  const start = HOOK_ANGLES.indexOf(project.hookAngle);
  for (let step = 1; step <= HOOK_ANGLES.length; step++) {
    const angle = HOOK_ANGLES[(start + step) % HOOK_ANGLES.length];
    const options = availableHooks(angle, vars, library).filter((h) => h.caption !== current?.caption);
    if (!options.length) continue;
    const hook = pick(options, rand);
    // Review scenes last as long as their spoken line, so a new first sentence gets a new length.
    const durationFor = (s: Scene) => (project.style?.template === "review" ? speechSeconds(hook.narration) : s.durationSec);
    return {
      hookAngle: angle,
      scenes: project.scenes.map((s) =>
        s.kind === "hook"
          ? {
              ...s,
              caption: hook.caption,
              narration: hook.narration,
              durationSec: durationFor(s),
              audioFile: undefined,
              audioDurationSec: undefined,
            }
          : s,
      ),
    };
  }
  return { hookAngle: project.hookAngle, scenes: project.scenes };
}

export type TextOverride = { caption?: string; subCaption?: string; narration?: string };

/** Applies LLM-written text onto a rule-based scene list by scene id. */
export function applyTextOverrides(scenes: Scene[], overrides: Record<string, TextOverride>): Scene[] {
  return scenes.map((scene) => {
    const o = overrides[scene.id];
    if (!o) return scene;
    return {
      ...scene,
      caption: o.caption?.trim().slice(0, 60) || scene.caption,
      subCaption: o.subCaption !== undefined ? o.subCaption.trim().slice(0, 60) : scene.subCaption,
      narration: o.narration?.trim().slice(0, 200) || scene.narration,
    };
  });
}
