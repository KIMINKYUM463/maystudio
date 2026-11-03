import type { HookAngle, TemplateId } from "../types";
import { josa } from "./josa";

export const HOOK_SLOTS = ["region", "price", "feature", "target", "stayType", "access", "occasion", "season"] as const;
export type HookSlot = (typeof HOOK_SLOTS)[number];
export type HookVars = Partial<Record<HookSlot, string>>;

export type HookTemplate = {
  caption: string;
  narration: string;
};

export const HOOK_ANGLE_LABELS: Record<HookAngle, { label: string; description: string; example: string }> = {
  condition: { label: "조건형", description: "[상황]에는 무조건 여기", example: "아이랑 겨울 온천은 무조건 여기 가세요" },
  contrast: { label: "대조형", description: "[숙소 유형]인데 [예상 밖의 것]에 진심", example: "한옥인데 노천탕에 진심인 곳" },
  curiosity: { label: "궁금증형", description: "답을 숨기고 물어요", example: "여기가 국내라는 게 믿기세요?" },
  empathy: { label: "공감형", description: "보는 사람의 지친 상황을 꺼내요", example: "방학 내내 집에서 버티는 중이신 분" },
  numbers: { label: "숫자형", description: "거리·시간·인원으로 선명하게", example: "서울에서 1시간, 눈 오는 노천탕" },
  twist: { label: "반전형", description: "기대를 한 번 뒤집어요", example: "평범한 펜션인 줄 알았는데, 문을 열자마자" },
  story: { label: "이야기형", description: "작은 사건으로 시작해요", example: "엄마 칠순 숙소 찾다가 대박인 곳 찾았어요" },
  tip: { label: "귀띔형", description: "놓치면 아쉬운 걸 알려줘요", example: "겨울에 강릉 가실 거면 무조건 여기 가세요" },
  price: { label: "가격형", description: "가격 대비 퀄리티로 멈추게", example: "강릉에서 1박 8만원대? 이 퀄리티 실화" },
};

/**
 * `{slot}` or `{slot:조사}` placeholders (조사 written in its after-consonant form: 은, 이, 을, 과, 이랑, 으로…).
 * A template is only used when every slot it references has a value, so each angle keeps
 * at least one slot-free line. The stay name is never a slot: the kit keeps it out of the video.
 */
export const HOOK_LIBRARY: Record<HookAngle, HookTemplate[]> = {
  condition: [
    { caption: "{target:이랑} {occasion:은}\n무조건 여기 가세요", narration: "{target:이랑} {occasion:은} 무조건 여기 가세요." },
    { caption: "{occasion:은}\n무조건 여기 가세요", narration: "{occasion:은} 무조건 여기 가세요." },
    { caption: "{target:이랑} {season} 여행은\n무조건 여기", narration: "{target:이랑} {season} 여행 가신다면 무조건 여기예요." },
    { caption: "이번 주말 쉬고 싶다면\n무조건 여기 가세요", narration: "이번 주말 제대로 쉬고 싶다면 무조건 여기 가세요." },
  ],
  contrast: [
    { caption: "{stayType}인데\n{feature}에 진심인 곳", narration: "{stayType}인데 {feature}에 진심인 곳이 있어요." },
    { caption: "{price}인데\n{feature}까지 있는 곳", narration: "{price}인데 {feature}까지 있는 곳이에요." },
    { caption: "평범해 보이는데\n디테일에 진심인 곳", narration: "겉으론 평범해 보이는데 디테일에 진심인 곳이에요." },
  ],
  curiosity: [
    { caption: "여기가 국내라는 게\n믿기세요?", narration: "여기가 국내라는 게 믿기세요?" },
    { caption: "{region}에 이런 곳이\n있는 거 아셨어요?", narration: "{region}에 이런 곳이 있는 거 아셨어요?" },
    { caption: "이 {stayType}, 어딘지\n맞혀보세요", narration: "이 {stayType}, 어딘지 한번 맞혀보세요." },
  ],
  empathy: [
    { caption: "요즘 너무 지쳤다면\n여기 보세요", narration: "요즘 너무 지쳤다면 여기 한번 보세요." },
    { caption: "{season} 내내 집에서\n버티는 중이신 분", narration: "{season} 내내 집에서 버티는 중이신 분, 여기 보세요." },
    { caption: "{target:과} 갈 곳\n아직 못 정했다면", narration: "{target:과} 갈 곳 아직 못 정하셨다면 여기예요." },
  ],
  numbers: [
    { caption: "{access},\n{feature}", narration: "{access}, {feature} 있는 곳이에요." },
    { caption: "{price:으로} 누리는\n{feature}", narration: "{price:으로} {feature}까지 누릴 수 있어요." },
    { caption: "1박 2일이면\n충분히 쉬다 오는 곳", narration: "딱 1박 2일이면 충분히 쉬다 올 수 있는 곳이에요." },
  ],
  twist: [
    { caption: "평범한 {stayType}인 줄 알았는데,\n문을 열자마자", narration: "평범한 {stayType}인 줄 알았는데, 문을 열자마자 생각이 바뀌었어요." },
    { caption: "밖에서 보면 평범한데\n안에 {feature:이} 있어요", narration: "밖에서 보면 평범한데, 안에 {feature:이} 있어요." },
    { caption: "평범한 숙소인 줄 알았는데,\n문을 열자마자", narration: "평범한 숙소인 줄 알았는데, 문을 열자마자 생각이 바뀌어요." },
  ],
  story: [
    { caption: "{occasion} 숙소 찾다가\n대박인 곳 찾았어요", narration: "{occasion} 숙소 찾다가 대박인 곳을 찾았어요." },
    { caption: "{target:이랑} 갈 숙소 찾다가\n여기 발견했어요", narration: "{target:이랑} 갈 숙소 찾다가 여기를 발견했어요." },
    { caption: "주말 숙소 찾다가\n대박인 곳 찾았어요", narration: "주말 숙소 찾다가 대박인 곳을 찾았어요." },
  ],
  tip: [
    { caption: "{season}에 {region} 가실 거면\n무조건 여기 가세요", narration: "{season}에 {region} 가실 거면 무조건 여기 가세요." },
    { caption: "{region} 가기 전에\n이건 꼭 저장하세요", narration: "{region} 가기 전에 이건 꼭 저장해 두세요." },
    { caption: "여행 가기 전에\n이건 꼭 저장하세요", narration: "여행 가기 전에 이건 꼭 저장해 두세요." },
  ],
  price: [
    { caption: "{region}에서 {price}?\n이 퀄리티 실화", narration: "{region}에서 {price}에 이런 숙소가 있다고요?" },
    { caption: "{price:으로} 누리는\n{feature}", narration: "{price:으로} {feature}까지 누릴 수 있어요." },
    { caption: "이 가격 맞아요?\n{region} {feature} 숙소", narration: "이 가격 진짜 맞나 싶은 {region} 숙소예요." },
    { caption: "이 가격에\n이 퀄리티라고?", narration: "이 가격에 이 퀄리티라니 말이 되나요?" },
  ],
};

/**
 * "review" template (benchmark @heo.jinny.gogo): `caption` is the two-line cover/carousel hook
 * ("프라이빗 사우나가\n방안에 있어요"), `narration` the spoken first sentence of the story
 * ("사우나를 내 방처럼 쓸 수 있는 숙소가 있어요."). The last line of each angle needs no slots.
 */
export const REVIEW_HOOK_LIBRARY: Record<HookAngle, HookTemplate[]> = {
  condition: [
    { caption: "{feature:이}\n방안에 있어요", narration: "{feature:을} 내 방처럼 쓸 수 있는 숙소가 있어요." },
    { caption: "{target:이랑} {season}엔\n무조건 여기예요", narration: "{target:이랑} {season}에 가기 딱 좋은 숙소가 있어요." },
    { caption: "이번 주말엔\n무조건 여기예요", narration: "이번 주말 제대로 쉬고 싶다면 여기 가보세요." },
  ],
  contrast: [
    { caption: "{stayType}인데\n{feature}까지 있어요", narration: "{stayType}인데 {feature}까지 있는 곳이 있어요." },
    { caption: "밖은 평범한데\n안은 완전 딴세상", narration: "밖에서 보면 평범한데 안은 완전 딴세상인 숙소가 있어요." },
  ],
  curiosity: [
    { caption: "{region}에 숨어있는\n비밀의 {stayType}", narration: "{region}에 이런 {stayType:이} 숨어 있는 거 아셨어요?" },
    { caption: "여기 해외 아니고\n국내입니다", narration: "여기 해외 아니고 국내에 있는 숙소예요." },
  ],
  empathy: [
    { caption: "{season}만 되면\n생각나는 {feature}", narration: "{season}만 되면 생각나는 {feature:이} 있는 곳이에요." },
    { caption: "요즘 너무 지쳤다면\n여기 가보세요", narration: "요즘 너무 지쳤다면 여기 한번 가보세요." },
  ],
  numbers: [
    { caption: "{access}\n{feature} 숙소", narration: "{access:이면} {feature}까지 있는 숙소에 갈 수 있어요." },
    { caption: "{price}\n나만 몰랐던 {stayType}", narration: "{price}에 이런 {stayType:이} 있다고 합니다." },
    { caption: "1박 2일이면\n충분한 힐링 숙소", narration: "딱 1박 2일이면 충분히 쉬다 올 수 있는 곳이 있어요." },
  ],
  twist: [
    { caption: "문만 열고 나가면\n{feature}", narration: "문만 열고 나가면 바로 {feature:이} 있는 숙소가 있어요." },
    { caption: "문 열자마자\n감탄 나오는 숙소", narration: "문 열자마자 감탄이 나오는 숙소가 있어요." },
  ],
  story: [
    { caption: "{target:이랑} 갈 곳 찾다가\n찾은 {stayType}", narration: "{target:이랑} 갈 숙소 찾다가 여기를 찾았어요." },
    { caption: "주말 숙소 찾다가\n대박인 곳 찾았어요", narration: "주말 숙소 찾다가 대박인 곳을 찾았어요." },
  ],
  tip: [
    { caption: "{season} 되기 전에\n꼭 저장할 {stayType}", narration: "{season} 되기 전에 꼭 저장해야 할 {stayType:이} 있어요." },
    { caption: "여행 가기 전에\n꼭 저장하세요", narration: "여행 가기 전에 꼭 저장해야 할 숙소가 있어요." },
  ],
  price: [
    { caption: "{stayType:이}\n{price}라구요?", narration: "{price}에 이런 {stayType:이} 있다고 합니다." },
    { caption: "{price:에}\n{feature}까지 있어요", narration: "{price:에} {feature}까지 누릴 수 있는 곳이 있어요." },
    { caption: "가격 보고\n눈을 의심했어요", narration: "가격 보고 눈을 의심했어요." },
  ],
};

export function hookLibraryFor(template: TemplateId): Record<HookAngle, HookTemplate[]> {
  return template === "review" ? REVIEW_HOOK_LIBRARY : HOOK_LIBRARY;
}

const SLOT_PATTERN = new RegExp(`\\{(${HOOK_SLOTS.join("|")})(?::([가-힣]+))?\\}`, "g");

/** Fills `{slot}` / `{slot:조사}` placeholders; returns null if any referenced slot is empty. */
export function fillTemplate(template: string, vars: HookVars): string | null {
  let missing = false;
  const filled = template.replace(SLOT_PATTERN, (_, key: HookSlot, particle?: string) => {
    const value = vars[key]?.trim();
    if (!value) {
      missing = true;
      return "";
    }
    return particle ? josa(value, particle) : value;
  });
  return missing ? null : filled;
}

const VIEW_FEATURE = /뷰|전망|풍경|노을|일출|야경|경치/;
/** "사우나를 내 방처럼 쓸 수 있는" fits facilities; "오션뷰를 내 방처럼" does not. */
const FACILITY_ONLY_HOOK = /\{feature[^}]*\}[^{]*(내 방처럼|방안에)/;

export function availableHooks(angle: HookAngle, vars: HookVars, library = HOOK_LIBRARY): HookTemplate[] {
  const isView = VIEW_FEATURE.test(vars.feature ?? "");
  return library[angle].flatMap((hook) => {
    if (isView && (FACILITY_ONLY_HOOK.test(hook.caption) || FACILITY_ONLY_HOOK.test(hook.narration))) return [];
    const caption = fillTemplate(hook.caption, vars);
    const narration = fillTemplate(hook.narration, vars);
    return caption && narration ? [{ caption, narration }] : [];
  });
}
