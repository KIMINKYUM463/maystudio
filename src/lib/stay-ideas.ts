import type { HookAngle, Product } from "./types";

export const IDEA_THEMES = {
  hotspring: { label: "온천·노천탕", occasion: "겨울 온천", target: "", keyword: "온천", hookAngle: "condition" },
  hanok: { label: "온돌·한옥", occasion: "겨울 한옥 여행", target: "부모님", keyword: "한옥", hookAngle: "contrast" },
  yearend: { label: "크리스마스·연말", occasion: "연말 호캉스", target: "커플", keyword: "연말", hookAngle: "empathy" },
  family: { label: "겨울방학·가족", occasion: "겨울방학", target: "아이", keyword: "방학", hookAngle: "condition" },
} as const satisfies Record<string, { label: string; occasion: string; target: string; keyword: string; hookAngle: HookAngle }>;

export type IdeaTheme = keyof typeof IDEA_THEMES;

export type StayIdea = {
  id: string;
  theme: IdeaTheme;
  name: string;
  region: string;
  /** The one-line pitch from the kit; becomes the first selling point. */
  pitch: string;
  stayType: string;
  /** Best-performing reel about this stay on other channels (kit, Oct 2026), in 만 views. */
  topViews: number;
};

/**
 * Kit "올겨울 바로 올리는 숙소 20곳". Winter availability (outdoor pools, open-air baths) and
 * prices change per stay, so the user still confirms everything on Coupang Trip.
 */
export const STAY_IDEAS: StayIdea[] = [
  { id: "sono-cheongsong", theme: "hotspring", name: "소노벨 청송", region: "경북 청송", pitch: "숲속 노천 온천", stayType: "리조트", topViews: 110 },
  { id: "nijimori", theme: "hotspring", name: "동두천 니지모리스튜디오 료칸", region: "경기 동두천", pitch: "서울 30분 거리의 일본 마을", stayType: "료칸", topViews: 82 },
  { id: "oreve", theme: "hotspring", name: "오레브 핫 스프링&스파", region: "제주 서귀포", pitch: "럭셔리 온천 스파", stayType: "호텔", topViews: 63 },
  { id: "forest-lovers", theme: "hotspring", name: "숲속의연인별 펜션&글램핑", region: "강원 횡성", pitch: "숲속 노천탕", stayType: "펜션", topViews: 33 },
  { id: "delpino", theme: "hotspring", name: "소노펠리체 델피노", region: "강원 고성", pitch: "설악 풍경의 온천", stayType: "리조트", topViews: 21 },
  { id: "osaek-greenyard", theme: "hotspring", name: "오색그린야드호텔", region: "강원 양양", pitch: "탄산 온천", stayType: "호텔", topViews: 20 },
  { id: "daeseonggwan", theme: "hotspring", name: "대성관 온천호텔", region: "부산 동래", pitch: "객실 야외 개인 온천", stayType: "호텔", topViews: 12 },
  { id: "seohae-train", theme: "hanok", name: "서해금빛열차 온돌 기차여행", region: "전북 군산", pitch: "누워서 가는 온돌방 기차", stayType: "기차", topViews: 58 },
  { id: "sadamjae", theme: "hanok", name: "문경 사담재", region: "경북 문경", pitch: "마당 온천", stayType: "한옥", topViews: 44 },
  { id: "yunseul-hanok", theme: "hanok", name: "함평 윤슬한옥", region: "전남 함평", pitch: "바다 앞 한옥마을", stayType: "한옥", topViews: 40 },
  { id: "lagung", theme: "hanok", name: "경주 라궁호텔", region: "경북 경주", pitch: "온천이 나오는 한옥", stayType: "한옥 호텔", topViews: 12 },
  { id: "cave-ryokan", theme: "yearend", name: "케이브 료칸 호텔 by 아늑", region: "서울 성북", pitch: "동굴 료칸", stayType: "호텔", topViews: 115 },
  { id: "aneuk-seongsu", theme: "yearend", name: "아늑 호텔 앤 스파 성수 건대점", region: "서울 광진", pitch: "전 객실 스파와 다도", stayType: "호텔", topViews: 77 },
  { id: "ije-namhae", theme: "yearend", name: "이제 남해", region: "경남 남해", pitch: "빨간 벽돌 료칸", stayType: "료칸", topViews: 66 },
  { id: "solbeach-namhae", theme: "yearend", name: "쏠비치 남해 호텔", region: "경남 남해", pitch: "수영장과 스케이트", stayType: "호텔", topViews: 52 },
  { id: "parkroche", theme: "yearend", name: "파크로쉬 리조트 앤 웰니스", region: "강원 정선", pitch: "산속 웰니스", stayType: "리조트", topViews: 24 },
  { id: "zephyrus", theme: "family", name: "대부도(영흥도) 제피루스 온수풀독채펜션", region: "인천 옹진", pitch: "온수풀 독채", stayType: "독채 펜션", topViews: 80 },
  { id: "hongsam-spa", theme: "family", name: "홍삼스파 참숯가마사우나", region: "경기 파주", pitch: "참숯가마 찜질방과 삼겹살", stayType: "찜질방", topViews: 72 },
  { id: "baekdudaegan-train", theme: "family", name: "백두대간 협곡열차", region: "경북 봉화", pitch: "눈 덮인 협곡을 달리는 기차", stayType: "기차", topViews: 55 },
  { id: "galaxy-x", theme: "family", name: "평창 갤럭시엑스 호텔형카라반", region: "강원 평창", pitch: "우주선 모양 카라반", stayType: "카라반", topViews: 21 },
];

export function findIdea(id: string): StayIdea | undefined {
  return STAY_IDEAS.find((idea) => idea.id === id);
}

export function coupangSearchUrl(name: string): string {
  return `https://trip.coupang.com/tp/search?q=${encodeURIComponent(name)}`;
}

/** Product fields an idea can honestly prefill; price, photos and link come from the Coupang page. */
export function productFromIdea(idea: StayIdea): Partial<Product> {
  const theme = IDEA_THEMES[idea.theme];
  return {
    category: "stay",
    name: idea.name,
    region: idea.region,
    features: [idea.pitch],
    stayType: idea.stayType,
    occasion: theme.occasion,
    target: theme.target,
    platform: "coupang",
  };
}
