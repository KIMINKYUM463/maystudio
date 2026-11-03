import type { Copy, Platform, Product, Scene, Style, TemplateId } from "../types";
import { josa } from "./josa";
import { proofLine, REVIEW_AUDIENCE } from "./review";
import { audienceOf } from "./romance";

export const MAX_HASHTAGS = 5;
export const LINK_PLACEHOLDER = "{링크}";

/** Wording Coupang Partners requires on every post and link page that carries a partner link. */
export const COUPANG_DISCLOSURE = "이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
const GENERAL_DISCLOSURE = "[광고] 이 게시물은 제휴 링크를 포함하며, 예약 시 일정액의 수수료를 받을 수 있어요.";

export function disclosureFor(platform: Platform): string {
  return platform === "coupang" ? COUPANG_DISCLOSURE : GENERAL_DISCLOSURE;
}

/** The caption must open with a disclosure (kit: "캡션 첫 줄처럼 잘 보이는 곳"). */
export function hasDisclosureFirst(caption: string): boolean {
  const first = caption.trimStart().split("\n")[0] ?? "";
  return first.startsWith("[광고]") || first.includes("수수료를 제공받습니다") || first.startsWith("#광고");
}

const TEMPLATE_TAGS: Record<TemplateId, string[]> = {
  review: ["숙소추천", "감성숙소"],
  emotional: ["감성숙소", "숙소추천"],
  deal: ["가성비숙소", "숙소특가"],
  luxury: ["호캉스", "럭셔리호텔"],
};

const CATEGORY_TAGS: Record<Product["category"], string> = {
  stay: "숙소",
  tour: "투어",
  ticket: "입장권",
  package: "여행",
};

export function normalizeTag(tag: string): string {
  return tag.replace(/^#+/, "").replace(/[\s#.,!?'"()[\]{}]/g, "");
}

export function buildHashtags(product: Product, template: TemplateId): string[] {
  const region = normalizeTag(product.region.split(/[\s,·]/)[0] ?? "");
  const city = normalizeTag(product.region.trim().split(/[\s,·]+/).at(-1) ?? "");
  const target = normalizeTag(product.target.split(/[,·/]/)[0] ?? "");
  const candidates = [
    region && `${region}${CATEGORY_TAGS[product.category]}`,
    city && product.stayType && `${city}${normalizeTag(product.stayType)}`,
    region && `${region}여행`,
    ...TEMPLATE_TAGS[template],
    target && `${target}여행`,
    "여행스타그램",
  ];
  const tags = candidates.map((t) => normalizeTag(t || "")).filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_HASHTAGS);
}

type CopySource = {
  product: Product;
  style: Pick<Style, "template" | "showName" | "watermark">;
  copy?: Pick<Copy, "linkNumber">;
};

/** The caption opens with the hook: the cover line normally, the spoken first sentence for "review". */
export function hookLineFor(scenes: Pick<Scene, "kind" | "caption" | "narration">[], template: TemplateId): string {
  const hook = scenes.find((s) => s.kind === "hook") ?? scenes[0];
  if (!hook) return "";
  return template === "review" ? hook.narration || hook.caption : hook.caption;
}

const REVIEW_CHECKS = 4;
const INSTAGRAM_HANDLE = /^@[A-Za-z0-9._]{1,30}$/;

/**
 * Caption layout of the benchmark (@heo.jinny.gogo), line for line: 감탄 첫 줄😳 → "알고 보니 여기는…"
 * → 경험🥰 → ✔️ 4개 → "…라면 한 번쯤은 꼭 가보셨으면 좋겠어요." → 만족✨ → 아무 댓글/팔로우/프로필링크 N번
 * → 해시태그 5개. "[광고]" stays in front so the hook is still the first thing people read.
 */
export function buildReviewCaption({ product, style, copy }: CopySource, hookLine: string, hashtags: string[]): string {
  const opener = hookLine.replace(/\s*\n\s*/g, " ").trim();
  const features = product.features.map((f) => f.trim()).filter(Boolean);
  const [first, second] = features;
  const audience = REVIEW_AUDIENCE[audienceOf(product.target)];
  const had = product.visited ? "있더라고요" : "있어요";
  const story = first ? [`${proofLine(product)}요,`, `${josa(first, "이")} ${had}.`] : [];
  const feeling = second
    ? [`${second}까지 있어서`, `${audience.activity} ${product.visited ? "너무 좋았어요" : "딱 좋아요"}.🥰`]
    : [];
  const verdict = product.visited ? "만족도 정말 높았던 숙소였습니다.✨" : "이번 여행지로 자신 있게 추천해요.✨";
  const handle = style.watermark.trim();
  const lines = [
    `[광고] ${opener}${/[?!.]$/.test(opener) ? "" : "."}😳`,
    "",
    ...story,
    "",
    ...feeling,
    "",
    ...features.slice(0, REVIEW_CHECKS).map((f) => `✔️ ${f}`),
    "",
    audience.wish,
    "한 번쯤은 꼭 가보셨으면 좋겠어요.",
    "",
    ...(product.priceText ? ["이 가격에 이 모든 걸 누릴 수 있다니,"] : []),
    verdict,
    "",
    "📌 숙소 정보가 궁금하신 분들은 아무 댓글이나 남겨주세요☺️",
    "⚠️팔로우를 하셔야 DM 오류가 없더라구요 😂",
    ...(copy?.linkNumber ? [`❤️ 프로필링크 ${copy.linkNumber}번에서도 확인할 수 있어요!`] : []),
    ...(INSTAGRAM_HANDLE.test(handle) ? [`🩵 바로가기 : ${handle}`] : []),
    "",
    disclosureFor(product.platform),
    "",
    hashtags.map((t) => `#${t}`).join(" "),
  ];
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildCaption({ product, style }: CopySource, hookLine: string, keyword: string, hashtags: string[]): string {
  const place = [product.region, style.showName && product.name].filter(Boolean).join(" | ");
  const info = [
    place && `📍 ${place}`,
    product.priceText &&
      `💰 ${product.priceText}${product.originalPriceText ? ` (정가 ${product.originalPriceText})` : ""} · 날짜별로 달라요`,
    product.rating && `⭐ ${product.rating}`,
  ].filter(Boolean) as string[];
  const features = product.features.map((f) => f.trim()).filter(Boolean).slice(0, 3);
  const lines = [disclosureFor(product.platform), hookLine.replace(/\n/g, " ").trim(), "", ...info];
  if (features.length) lines.push("", ...features.map((f) => `✔ ${f}`));
  lines.push(
    "",
    hashtags.map((t) => `#${t}`).join(" "),
    "",
    `👉 숙소 정보는 댓글에 '${keyword}' 남겨주세요! DM으로 보내드려요`,
  );
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildPinnedComment(keyword: string, template: TemplateId = "emotional"): string {
  return template === "review"
    ? "📌 숙소 정보는 아무 댓글이나 남겨주시면 DM으로 보내드려요! 팔로우하셔야 DM이 잘 가요 (광고·제휴 링크 포함)"
    : `📌 숙소 정보는 댓글에 '${keyword}' 남기면 DM으로 보내드려요! (광고·제휴 링크 포함)`;
}

export function buildDmTemplate(product: Product): string {
  const name = product.name || "영상 속 숙소";
  const priceLine = product.priceText ? `💰 ${product.priceText} (날짜별로 가격이 달라요)` : "";
  const disclosure =
    product.platform === "coupang"
      ? COUPANG_DISCLOSURE
      : "#광고 이 링크로 예약하시면 소정의 수수료를 받아요. 추가 비용은 없어요 🙏";
  return [`안녕하세요! 영상 속 숙소는 ${josa(name, "이에요")} 👇`, LINK_PLACEHOLDER, priceLine, "", disclosure]
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n")
    .trim();
}

/** Replaces the link placeholder with the actual link. */
export function fillDmLink(dmTemplate: string, link: string): string {
  return dmTemplate.split(LINK_PLACEHOLDER).join(link);
}

export function buildCopy(source: CopySource, hookLine: string, keyword: string): Copy {
  const { template } = source.style;
  const hashtags = buildHashtags(source.product, template);
  return {
    caption:
      template === "review"
        ? buildReviewCaption(source, hookLine, hashtags)
        : buildCaption(source, hookLine, keyword, hashtags),
    hashtags,
    commentKeyword: keyword,
    pinnedComment: buildPinnedComment(keyword, template),
    dmTemplate: buildDmTemplate(source.product),
    linkNumber: source.copy?.linkNumber,
  };
}
