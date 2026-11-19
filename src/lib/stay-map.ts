import data from "./data/stay-map.json";
import type { Product } from "./types";

/** One stay from 메이의 숙소여행지도: how its reels did across other channels (regenerate with scripts/extract-stay-map.py). */
export type MapStay = {
  name: string;
  region: string;
  province: string;
  type: string;
  channels: number;
  reels: number;
  views: number;
  comments: number;
  latest: string;
  topReel: { url: string; views: number; label: string };
};

/** Sorted by total views, most first. */
export const MAP_STAYS = data as MapStay[];

export const MAP_TYPES = ["풀빌라·펜션", "호텔·리조트", "온천·료칸", "캠핑·글램핑", "한옥", "여행상품", "기타"] as const;

const STAY_TYPE: Record<string, string> = {
  "풀빌라·펜션": "풀빌라",
  "호텔·리조트": "호텔",
  "온천·료칸": "료칸",
  "캠핑·글램핑": "글램핑",
  한옥: "한옥",
};

export function findMapStay(name: string): MapStay | undefined {
  return MAP_STAYS.find((s) => s.name === name);
}

/** "8510555" → "851만": the map's numbers as people say them. */
export function formatViews(views: number): string {
  if (views >= 100_000_000) return `${(views / 100_000_000).toFixed(1).replace(/\.0$/, "")}억`;
  if (views >= 10_000) return `${Math.round(views / 10_000).toLocaleString("ko-KR")}만`;
  return views.toLocaleString("ko-KR");
}

/** What a map stay can fill in; photos still come from the listing link. The reaction is a real fact the script may use. */
export function productFromMapStay(stay: MapStay): Partial<Product> {
  return {
    name: stay.name,
    region: stay.region.startsWith("해외") ? "" : stay.region,
    stayType: STAY_TYPE[stay.type] ?? "숙소",
    category: stay.type === "여행상품" ? "package" : "stay",
    notes: `다른 채널 릴스 ${stay.reels}개 · 누적 조회수 ${formatViews(stay.views)}회 · 댓글 ${formatViews(stay.comments)}개 (최근 ${stay.latest})`,
  };
}
