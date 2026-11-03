import { load } from "cheerio";
import type { Platform, Product } from "./types";

export type ImportedImage = { url: string; label: string };

export type ImportResult = {
  product: Partial<Product>;
  images: ImportedImage[];
};

const PLATFORM_HOSTS: Array<[RegExp, Platform]> = [
  [/(^|\.)coupang\.com$/, "coupang"],
  [/myrealtrip\.com$/, "myrealtrip"],
  [/agoda\.(com|co\.kr)$/, "agoda"],
  [/trip\.com$/, "tripcom"],
  [/yanolja\.com$|goodchoice\.kr$|yeogi\.com$/, "yeogi"],
  [/klook\.com$/, "klook"],
  [/booking\.com$/, "booking"],
];

export function detectPlatform(url: string): Platform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return PLATFORM_HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? "other";
  } catch {
    return "other";
  }
}

type JsonLd = Record<string, unknown>;

const LODGING_TYPES = /Hotel|LodgingBusiness|Resort|BedAndBreakfast|Hostel|Motel|VacationRental|Product|TouristTrip|Accommodation/i;

function flattenJsonLd(node: unknown): JsonLd[] {
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd);
  if (node && typeof node === "object") {
    const obj = node as JsonLd;
    return [obj, ...(obj["@graph"] ? flattenJsonLd(obj["@graph"]) : [])];
  }
  return [];
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function imagesFrom(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imagesFrom);
  if (typeof value === "object") return imagesFrom((value as JsonLd).url ?? (value as JsonLd).contentUrl);
  return [];
}

export function formatWon(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function priceFrom(offers: unknown, priceRange: unknown): string {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const offer of list as JsonLd[]) {
    const raw = offer.lowPrice ?? offer.price;
    const value = Number(str(raw).replace(/[^\d.]/g, ""));
    if (value > 0) {
      const currency = str(offer.priceCurrency).toUpperCase();
      return currency && currency !== "KRW" ? `${currency} ${value.toLocaleString()}~` : `${formatWon(value)}~`;
    }
  }
  return str(priceRange);
}

function regionFrom(address: unknown): string {
  if (!address || typeof address !== "object") return str(address);
  const a = address as JsonLd;
  return [str(a.addressRegion), str(a.addressLocality)].filter(Boolean).join(" ");
}

function absolutize(url: string, base: string): string | null {
  try {
    const abs = new URL(url, base);
    return abs.protocol === "http:" || abs.protocol === "https:" ? abs.toString() : null;
  } catch {
    return null;
  }
}

/** Extracts product info from site-specific data, then OG tags and schema.org JSON-LD. */
export function parseProductHtml(html: string, pageUrl: string): ImportResult {
  const $ = load(html);
  const coupang = $("#travel-detail-product-data").text();
  if (coupang) {
    try {
      return parseCoupangTravel(JSON.parse(coupang), pageUrl);
    } catch {
      // Fall through to the generic parser if Coupang changes its data shape.
    }
  }
  const meta = (key: string) =>
    $(`meta[property="${key}"]`).attr("content")?.trim() || $(`meta[name="${key}"]`).attr("content")?.trim() || "";

  const nodes = $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((el) => {
      try {
        return flattenJsonLd(JSON.parse($(el).text()));
      } catch {
        return [];
      }
    });
  const lodging = nodes.find((n) => LODGING_TYPES.test(String(n["@type"] ?? "")));

  const rawTitle = str(lodging?.name) || meta("og:title") || $("title").text().trim();
  const name = rawTitle.split(/\s[|\-–]\s/)[0].trim().slice(0, 80);
  const rating = lodging?.aggregateRating
    ? str((lodging.aggregateRating as JsonLd).ratingValue)
    : "";
  const images = [
    ...imagesFrom(lodging?.image),
    meta("og:image"),
    meta("og:image:secure_url"),
    meta("twitter:image"),
  ]
    .map((u) => (u ? absolutize(u, pageUrl) : null))
    .filter((u): u is string => Boolean(u));

  return {
    product: {
      name,
      region: regionFrom(lodging?.address),
      priceText: lodging ? priceFrom(lodging.offers, lodging.priceRange) : "",
      rating: rating ? String(Math.round(Number(rating) * 10) / 10) : "",
      sourceUrl: pageUrl,
      platform: detectPlatform(pageUrl),
    },
    images: [...new Set(images)].slice(0, 8).map((url) => ({ url, label: "" })),
  };
}

const PROVINCES: Array<[RegExp, string]> = [
  [/^서울/, "서울"],
  [/^부산/, "부산"],
  [/^대구/, "대구"],
  [/^인천/, "인천"],
  [/^광주/, "광주"],
  [/^대전/, "대전"],
  [/^울산/, "울산"],
  [/^세종/, "세종"],
  [/^경기/, "경기"],
  [/^강원/, "강원"],
  [/^충청?북|^충북/, "충북"],
  [/^충청?남|^충남/, "충남"],
  [/^전라?북|^전북/, "전북"],
  [/^전라?남|^전남/, "전남"],
  [/^경상?북|^경북/, "경북"],
  [/^경상?남|^경남/, "경남"],
  [/^제주/, "제주"],
];

/** "전라북도 부안군 변산면 …" → "전북 부안", "서울특별시 성북구 …" → "서울 성북". */
export function shortAddress(address: string): string {
  const [first = "", second = ""] = address.trim().split(/\s+/);
  const province = PROVINCES.find(([pattern]) => pattern.test(first))?.[1] ?? first;
  const city = /^[가-힣]{2,}[시군구]$/.test(second) ? second.slice(0, -1) : second;
  return [province, city].filter(Boolean).join(" ");
}

const COUPANG_STAY_TYPES: Record<string, string> = {
  HOTEL: "호텔",
  RESORT: "리조트",
  CONDO: "콘도",
  PENSION: "펜션",
  POOL_VILLA: "풀빌라",
  POOLVILLA: "풀빌라",
  MOTEL: "모텔",
  GUEST_HOUSE: "게스트하우스",
  GUESTHOUSE: "게스트하우스",
  HANOK: "한옥",
  RYOKAN: "료칸",
  GLAMPING: "글램핑",
  CAMPING: "캠핑",
  CARAVAN: "카라반",
};

const COUPANG_IMAGE_LABELS: Record<string, string> = { view: "전경", room: "객실" };

/** Coupang themes → the audience words our hooks and romance lines understand. */
const COUPANG_TARGETS: Array<[RegExp, string]> = [
  [/가족|키즈|아이/, "아이"],
  [/커플|연인/, "커플"],
  [/부모|효도/, "부모님"],
  [/친구|우정|파티/, "친구"],
];

/** Coupang CDN serves resized crops; dropping the resize segment returns the original photo. */
export function coupangOriginalImage(path: string): string {
  const absolute = path.startsWith("//") ? `https:${path}` : path;
  return absolute.replace(/\/image\/resized_image\/thumbnails\/remote\/[^/]+\/image\//, "/image/");
}

type CoupangImage = { originImagePath?: string };
type CoupangData = {
  product?: {
    productName?: string;
    productDetailType?: string;
    location?: { address?: string };
    productReview?: { ratingAverage?: number; ratingCount?: number };
    facilities?: Array<{ title?: string; facilities?: Array<{ description?: string }> }>;
    introductions?: Array<{ themes?: string[]; description?: string }>;
    imageGroups?: Array<{ type?: string; name?: string; images?: CoupangImage[] }>;
    representativeVendorItem?: { price?: Record<string, unknown> };
    bestReview?: { reviewContent?: { title?: string; content?: string } };
  };
};

const MAX_COUPANG_IMAGES = 20;

/** Reads the JSON Coupang Travel embeds in `<script id="travel-detail-product-data">`. */
export function parseCoupangTravel(data: CoupangData, pageUrl: string): ImportResult {
  const p = data.product;
  if (!p?.productName) throw new Error("Not a Coupang Travel product");

  const facilityGroups = p.facilities ?? [];
  const popular = facilityGroups.find((g) => g.title?.includes("인기")) ?? facilityGroups.find((g) => g.title?.includes("편의시설"));
  const features = (popular?.facilities ?? [])
    .map((f) => str(f.description))
    .filter((f) => f && !/주차장|엘리베이터|인터넷|wifi|세탁|편의점/i.test(f))
    .slice(0, 6);

  const themes = p.introductions?.flatMap((i) => i.themes ?? []) ?? [];
  const target = COUPANG_TARGETS.find(([pattern]) => themes.some((t) => pattern.test(t)))?.[1] ?? "";

  const labels = new Map<string, string>();
  for (const group of p.imageGroups ?? []) {
    if (group.type === "all") continue;
    const label = COUPANG_IMAGE_LABELS[group.type ?? ""] ?? str(group.name).slice(0, 30);
    for (const image of group.images ?? []) {
      if (image.originImagePath && !labels.has(image.originImagePath)) labels.set(image.originImagePath, label);
    }
  }
  const all = p.imageGroups?.find((g) => g.type === "all")?.images ?? p.imageGroups?.flatMap((g) => g.images ?? []) ?? [];
  const seen = new Set<string>();
  const images = all.flatMap((image) => {
    const path = image.originImagePath;
    if (!path) return [];
    const url = absolutize(coupangOriginalImage(path), pageUrl);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ url, label: labels.get(path) ?? "" }];
  });

  const price = p.representativeVendorItem?.price ?? {};
  const priceValue = [price.unitPrice, price.salePrice, price.previewFinalUnitPrice].find(
    (v): v is number => typeof v === "number" && v > 0,
  );
  const review = p.bestReview?.reviewContent;
  const notes = [
    review?.content && `베스트 리뷰: ${[review.title, review.content].filter(Boolean).join(" - ")}`,
    themes.length ? `숙소 테마: ${themes.join(", ")}` : "",
    str(p.introductions?.[0]?.description).replace(/\s+/g, " ").slice(0, 400),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
  const rating = p.productReview?.ratingCount ? p.productReview.ratingAverage : undefined;

  return {
    product: {
      // "소노벨 변산 (구 대명리조트 변산/…)" → "소노벨 변산"
      name: p.productName.replace(/\s*[([].*?[)\]]\s*/g, " ").trim().slice(0, 80),
      category: "stay",
      stayType: COUPANG_STAY_TYPES[str(p.productDetailType).toUpperCase()] ?? "",
      region: shortAddress(str(p.location?.address)),
      priceText: priceValue ? `1박 ${formatWon(priceValue)}~` : "",
      rating: rating ? rating.toFixed(1) : "",
      features,
      target,
      notes,
      sourceUrl: pageUrl,
      platform: "coupang",
    },
    images: images.slice(0, MAX_COUPANG_IMAGES),
  };
}

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

/** Only public http(s) URLs may be fetched by the importer. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("올바른 URL이 아닙니다.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("http(s) 주소만 가능합니다.");
  if (PRIVATE_HOST.test(url.hostname)) throw new Error("내부 네트워크 주소는 가져올 수 없습니다.");
  return url;
}
