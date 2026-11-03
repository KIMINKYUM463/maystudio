import type { Product } from "../types";

/** Who the stay is for; picks the romance line that fits the viewer's trip. */
export type Audience = "family" | "couple" | "parents" | "friends" | "solo" | "any";

const AUDIENCE_PATTERNS: Array<[RegExp, Audience]> = [
  [/아이|아기|키즈|가족|자녀|방학/, "family"],
  [/부모|엄마|아빠|효도|칠순|환갑|어르신/, "parents"],
  [/커플|연인|부부|남편|아내|신혼|기념일|둘이/, "couple"],
  [/친구|우정|동창/, "friends"],
  [/혼자|나홀로|1인/, "solo"],
];

export function audienceOf(target: string): Audience {
  return AUDIENCE_PATTERNS.find(([pattern]) => pattern.test(target))?.[1] ?? "any";
}

export type RomanceLine = { caption: string; narration: string };

type RomanceRule = {
  pattern: RegExp;
  /** FAB "좋은 점": what the feature does for the guest. */
  benefit: string;
  lines: Partial<Record<Audience, RomanceLine>> & { any: RomanceLine };
};

/**
 * Feature → benefit → romance (FAB). Lines describe the moment the viewer would have there
 * rather than claiming the creator stayed, so they never read as a fake review.
 */
const HOT_WATER = "노천|온천|스파|자쿠지|히노끼|반신욕|욕조|탕";

const ROMANCE_RULES: RomanceRule[] = [
  {
    // Privacy is only claimed when the listing says so ("객실 전용 노천탕"); a resort's open-air bath is shared.
    pattern: new RegExp(`(전용|개별|개인|프라이빗|객실).*(${HOT_WATER})|(${HOT_WATER}).*(전용|개별|프라이빗)`),
    benefit: "다른 손님 눈치 없이 몸을 녹여요",
    lines: {
      couple: {
        caption: "눈치 볼 사람 없이\n둘이 김 오르는 물에",
        narration: "눈치 볼 사람 없이 둘이 김 오르는 물에 앉아 있으면 시간 가는 줄 몰라요.",
      },
      family: {
        caption: "우리 가족만 쓰는\n따뜻한 물",
        narration: "우리 가족만 쓰는 따뜻한 물에 몸 녹이다 보면 하루 피로가 다 풀려요.",
      },
      any: {
        caption: "우리끼리만 쓰는\n김 오르는 탕",
        narration: "우리끼리만 쓰는 탕에 앉아 있으면 시간 가는 줄 몰라요.",
      },
    },
  },
  {
    pattern: new RegExp(HOT_WATER),
    benefit: "추운 날 몸이 사르르 녹아요",
    lines: {
      couple: {
        caption: "김 오르는 물에\n둘이 나란히",
        narration: "김 오르는 물에 둘이 나란히 앉아 있으면 시간 가는 줄 몰라요.",
      },
      family: {
        caption: "추운 날 아이랑\n따뜻한 물에 몸 녹이기",
        narration: "추운 날 아이랑 따뜻한 물에 몸 녹이다 보면 하루 피로가 다 풀려요.",
      },
      parents: {
        caption: "뜨끈한 물에 몸 담그신\n부모님 얼굴",
        narration: "뜨끈한 물에 몸 담그신 부모님 얼굴, 그거 하나면 충분해요.",
      },
      any: {
        caption: "김 오르는 물에\n가만히 앉아 있기",
        narration: "김 오르는 물에 가만히 앉아 있다 보면 시간 가는 줄 몰라요.",
      },
    },
  },
  {
    pattern: /온수풀|온수 ?수영장|실내 ?수영장/,
    benefit: "추운 날에도 물놀이가 돼요",
    lines: {
      family: {
        caption: "따뜻한 물에서\n나올 생각 없는 아이들",
        narration: "추운 날인데도 아이들이 따뜻한 물에서 나올 생각을 안 해요.",
      },
      any: { caption: "밖은 추운데\n물은 따뜻한 날", narration: "밖은 추운데 따뜻한 물에 둥둥 떠 있으면 여기가 해외 같아요." },
    },
  },
  {
    pattern: /수영장|풀빌라|인피니티|키즈풀|워터파크|풀$/,
    benefit: "숙소 안에서 물놀이까지 해요",
    lines: {
      family: { caption: "물에서 나올 생각\n없는 아이들", narration: "아이들이 물에서 나올 생각을 안 해요." },
      couple: { caption: "둘이 둥둥 떠서\n물멍하는 오후", narration: "둘이 물 위에 둥둥 떠 있으면 여기가 해외 같아요." },
      any: { caption: "하루 종일\n물멍하는 날", narration: "물 위에 둥둥 떠서 하루 종일 물멍하기 좋아요." },
    },
  },
  {
    pattern: /온돌|한옥|구들|황토/,
    benefit: "바닥이 뜨끈해요",
    lines: {
      parents: {
        caption: "뜨끈한 온돌방에\n누우신 부모님",
        narration: "뜨끈한 온돌방에 누우시면 부모님이 먼저 좋아하세요.",
      },
      any: {
        caption: "뜨끈한 바닥에\n등 대고 누우면",
        narration: "뜨끈한 바닥에 등 대고 누우면 그대로 잠들 것 같아요.",
      },
    },
  },
  {
    pattern: /오션|바다|해변|해안|씨뷰/,
    benefit: "창밖이 바로 바다예요",
    lines: {
      couple: { caption: "바다 보면서\n둘이 와인 한 잔", narration: "창밖 바다 보면서 둘이 와인 한 잔이면 그날은 끝이에요." },
      any: { caption: "눈 뜨자마자\n창밖이 바다", narration: "아침에 눈 뜨자마자 창밖으로 바다가 펼쳐져요." },
    },
  },
  {
    pattern: /통창|뷰|전망|노을|일출/,
    benefit: "창밖 풍경이 그림 같아요",
    lines: {
      couple: { caption: "창밖 풍경 보면서\n둘이 커피 한 잔", narration: "창밖 풍경 보면서 둘이 커피 한 잔이면 그날은 끝이에요." },
      any: { caption: "창밖 풍경 보며\n아무것도 안 하기", narration: "창밖 풍경만 보고 있어도 마음이 쉬어져요." },
    },
  },
  {
    pattern: /설경|숲|산속|계곡|자연|정원|마당/,
    benefit: "자연 한가운데서 쉬어요",
    lines: {
      any: { caption: "창밖이 온통 숲이라\n아무것도 안 해도", narration: "창밖이 온통 숲이라 아무것도 안 해도 마음이 쉬어져요." },
    },
  },
  {
    pattern: /불멍|벽난로|캠프파이어|화로|장작/,
    benefit: "밤에 불멍이 돼요",
    lines: {
      couple: { caption: "장작 타는 소리 들으며\n둘이 불멍", narration: "장작 타는 소리 들으면서 둘이 불멍하다 보면 밤이 금방 가요." },
      any: { caption: "장작 타는 소리 들으며\n불멍하는 밤", narration: "장작 타는 소리 들으면서 불멍하다 보면 밤이 금방 가요." },
    },
  },
  {
    pattern: /바비큐|바베큐|bbq|그릴|숯불/i,
    benefit: "숙소에서 바로 고기를 구워요",
    lines: {
      family: { caption: "마당에서 숯불에\n고기 굽는 저녁", narration: "마당에서 숯불에 고기 구우면 아이들이 제일 신나요." },
      friends: { caption: "숯불에 고기 굽고\n밤새 수다", narration: "숯불에 고기 굽고 밤새 수다 떨기 딱 좋은 곳이에요." },
      any: { caption: "숯불에 고기 굽고\n별 보는 밤", narration: "숯불에 고기 굽고 나면 하늘에 별이 가득해요." },
    },
  },
  {
    pattern: /찜질|사우나|참숯|가마/,
    benefit: "몸속까지 뜨끈해져요",
    lines: {
      any: { caption: "땀 쫙 빼고 나오면\n몸이 새것처럼", narration: "뜨끈하게 땀 쫙 빼고 나오면 몸이 새것처럼 가벼워요." },
    },
  },
  {
    pattern: /료칸|다다미|다도/,
    benefit: "일본 감성을 국내에서 느껴요",
    lines: {
      any: { caption: "비행기 안 타도\n료칸 감성 그대로", narration: "비행기 안 타도 료칸 감성을 그대로 느낄 수 있어요." },
    },
  },
  {
    pattern: /야경|루프탑|라운지|전망/,
    benefit: "밤 풍경이 예뻐요",
    lines: {
      couple: { caption: "반짝이는 야경 보며\n둘만의 밤", narration: "반짝이는 야경 보면서 둘만의 밤을 보내기 좋아요." },
      any: { caption: "불 켜진 야경 보며\n하루 마무리", narration: "불 켜진 야경 보면서 하루를 마무리하기 좋아요." },
    },
  },
  {
    pattern: /조식|브런치|레스토랑/,
    benefit: "아침이 여유로워요",
    lines: {
      any: { caption: "창가 자리에서\n여유로운 아침", narration: "창가 자리에 앉아 여유롭게 아침 먹는 것부터 여행이에요." },
    },
  },
  {
    pattern: /기차|열차/,
    benefit: "이동 자체가 여행이에요",
    lines: {
      any: { caption: "창밖 풍경 보며\n달리는 기차", narration: "창밖 풍경 보면서 달리다 보면 이동 시간이 제일 좋아요." },
    },
  },
];

const FALLBACK: RomanceLine = {
  caption: "아무 계획 없이\n쉬기만 해도 좋은 곳",
  narration: "아무 계획 없이 쉬기만 해도 충분한 곳이에요.",
};

export type RomanceSuggestion = RomanceLine & { feature: string; benefit: string };

/** One FAB row per feature that has a romance rule (feature order kept). */
export function romanceSuggestions(product: Pick<Product, "features" | "target">): RomanceSuggestion[] {
  const audience = audienceOf(product.target);
  return product.features.flatMap((feature) => {
    const rule = ROMANCE_RULES.find((r) => r.pattern.test(feature));
    if (!rule) return [];
    return [{ feature, benefit: rule.benefit, ...(rule.lines[audience] ?? rule.lines.any) }];
  });
}

/** The kit asks for exactly one romance line per video: the first feature that has one. */
export function romanceFor(product: Pick<Product, "features" | "target">): RomanceSuggestion {
  return romanceSuggestions(product)[0] ?? { feature: "", benefit: "", ...FALLBACK };
}
