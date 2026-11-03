/**
 * Image-to-video prompts for AI video tools (Kling, Hailuo, Veo, Runway…): one 9:16 clip per photo.
 * Wording follows the kit: describe only small motion already implied by the photo, and pin
 * everything else down so the tool doesn't invent cuts, objects or new faces.
 */
const KEEP_SCENE =
  "Single continuous shot from the very first frame, no cuts, no scene change, no new objects or structures, keep everything in the image, realistic, 9:16 vertical.";
const NO_PEOPLE = "No people appear.";
const SAME_PEOPLE =
  "Same people throughout the clip, do not change face, hair, age or clothing; no new people appear; everyone stays the same Korean (East Asian) person as in the image, never a foreigner.";

export const PROMPT_TYPES = [
  {
    id: "hotspring",
    label: "온천·노천탕",
    pattern: /온천|노천|탕|스파|자쿠지|히노끼|욕조/,
    motion: "Static tripod shot; soft steam rises slowly from the hot spring water, the surface ripples gently and warm light glows on the stones.",
  },
  {
    id: "pool",
    label: "수영장",
    pattern: /수영장|풀|pool|워터파크/i,
    motion: "Static tripod shot; the pool water ripples gently, sunlight sparkles on the surface and the trees around sway softly in the breeze.",
  },
  {
    id: "night",
    label: "야경",
    pattern: /야경|밤|night|조명|루프탑/i,
    motion: "Static tripod shot; the lights twinkle softly in the night, the windows glow warmly and a few clouds drift slowly across the dark sky.",
  },
  {
    id: "fire",
    label: "숯불·바비큐",
    pattern: /바비큐|바베큐|bbq|그릴|숯불|화로|불멍|캠프파이어|벽난로/i,
    motion: "Static close shot; the charcoal glows and pulses red, small flames flicker and light smoke rises.",
  },
  {
    id: "kiln",
    label: "참숯가마·찜질",
    pattern: /참숯|가마|찜질|사우나/,
    motion: "Static close shot; the charcoal pile glows and pulses red, small flames flicker across the top.",
  },
  {
    id: "food",
    label: "음식·조식",
    pattern: /조식|음식|식사|레스토랑|요리|디저트|food|breakfast/i,
    motion: "Static close shot; light steam rises from the hot food, the sauce glistens and the cold drink bubbles softly.",
  },
  {
    id: "interior",
    label: "실내·객실",
    pattern: /객실|침실|방|실내|거실|욕실|room|bed|침대|온돌|다다미/i,
    motion: "Camera glides slowly forward into the room; the sheer curtain sways gently and soft daylight shifts across the floor.",
  },
  {
    id: "view",
    label: "전경·외관",
    pattern: /전경|외관|건물|입구|마당|정원|한옥|exterior/i,
    motion: "Very slow push-in toward the building; soft light glows in the windows and the trees around sway gently in the breeze.",
  },
  {
    id: "nature",
    label: "자연 풍경",
    pattern: /풍경|바다|오션|뷰|산|숲|설경|계곡|노을|해변|view/i,
    motion: "Slow drone glide forward over the landscape; the trees sway gently in the breeze and the clouds drift slowly across the sky.",
  },
] as const;

export type PromptTypeId = (typeof PROMPT_TYPES)[number]["id"];

const PEOPLE_PATTERN = /사람|인물|가족|커플|아이|부모|친구|모델/;

export function detectPromptType(label: string): PromptTypeId {
  return PROMPT_TYPES.find((t) => t.pattern.test(label))?.id ?? "nature";
}

export function labelHasPeople(label: string): boolean {
  return PEOPLE_PATTERN.test(label);
}

export function buildVideoPrompt(type: PromptTypeId, withPeople: boolean): string {
  const motion = PROMPT_TYPES.find((t) => t.id === type)?.motion ?? PROMPT_TYPES[0].motion;
  return [motion, withPeople ? SAME_PEOPLE : NO_PEOPLE, KEEP_SCENE].join(" ");
}
