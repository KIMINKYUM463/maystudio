/**
 * Extra subtitle/caption fonts the user can pick (copied from the user's wingsaistudio public/fonts).
 * Each file is one weight; free for commercial use (Gmarket, SB Aggro, TMON, Cafe24, Gangwon) or OFL
 * (Do Hyeon, Gowun Dodum, Nanum Handwriting).
 */
export const FONT_CHOICES = [
  { id: "gmarket", family: "GmarketSansBold", file: "fonts/gmarket-sans-bold.ttf", label: "G마켓 산스", mood: "굵고 반듯한" },
  { id: "dohyeon", family: "DoHyeon", file: "fonts/do-hyeon-regular.ttf", label: "도현", mood: "단단한 제목체" },
  { id: "aggro", family: "SBAggroBold", file: "fonts/sb-aggro-bold.ttf", label: "어그로체", mood: "시선 끄는 굵은" },
  { id: "monsori", family: "TmonMonsori", file: "fonts/tmon-monsori-black.ttf", label: "몬소리체", mood: "통통 튀는 예능" },
  { id: "cafe24", family: "Cafe24ProSlimMax", file: "fonts/cafe24-pro-slim-max.ttf", label: "카페24 슬림", mood: "길쭉하고 세련된" },
  { id: "gangwon", family: "GangwonModuBold", file: "fonts/gangwon-modu-bold.ttf", label: "강원모두체", mood: "둥글고 친근한" },
  { id: "gowun", family: "GowunDodum", file: "fonts/gowun-dodum-regular.ttf", label: "고운돋움", mood: "부드럽고 차분한" },
  { id: "galmaet", family: "NanumGalmaetgeul", file: "fonts/nanum-handwriting-galmaetgeul.ttf", label: "나눔 손글씨", mood: "손글씨 감성" },
  // 메이 강사님 스타일 (2026-11-22): subtitle KonKon / Gmarket / Pretendard SemiBold, cover KonKon / Yache / Paperlogy.
  { id: "konkon", family: "OnglyphKonKon", file: "fonts/onglyph-konkon.ttf", label: "콘콘체", mood: "동글동글 손글씨" },
  { id: "yache", family: "YanoljaYacheBold", file: "fonts/yanolja-yache-bold.ttf", label: "야체", mood: "통통 튀는 굵은" },
  { id: "paperlogy", family: "Paperlogy7Bold", file: "fonts/paperlogy-7bold.ttf", label: "페이퍼로지", mood: "깔끔하고 단단한" },
  // Already loaded as the app's variable sans; drawn at weight 600 (SemiBold).
  { id: "pretendard", family: "Pretendard", file: "fonts/PretendardVariable.woff2", label: "프리텐다드", mood: "또렷한 기본 고딕" },
] as const;

export type FontChoiceId = (typeof FONT_CHOICES)[number]["id"];
export const FONT_CHOICE_IDS = FONT_CHOICES.map((f) => f.id) as [FontChoiceId, ...FontChoiceId[]];

export function fontFamilyFor(id: string): string | null {
  return FONT_CHOICES.find((f) => f.id === id)?.family ?? null;
}
