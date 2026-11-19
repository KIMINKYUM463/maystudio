/**
 * Image-to-video prompts for AI video tools (Kling, Hailuo, Veo, Runway…): one 9:16 clip per photo.
 * Wording follows the kit: describe only small motion already implied by the photo, and pin
 * everything else down so the tool doesn't invent cuts, objects or new faces.
 */
/**
 * Shape lock (2026-11-19, user: "사물·건물 형태는 보존"). Big camera moves are what make rooms and buildings
 * bend, so the camera stays almost still and only soft natural elements are allowed to move.
 */
const KEEP_SCENE = [
  "Single continuous shot from the very first frame, no cuts, no scene change.",
  "Preserve the exact shape, size, position and perspective of every building, wall, roof, window, door, furniture, bed, bathtub and object.",
  "Rigid structures never bend, warp, melt, stretch, wobble or morph; straight lines stay perfectly straight; nothing appears or disappears.",
  "Only the soft natural elements named above move, subtly and slowly. Photorealistic, same lighting and colours as the photo.",
].join(" ");
const NO_PEOPLE = "No people appear.";
const SAME_PEOPLE =
  "Same people throughout the clip, do not change face, hair, age or clothing; no new people appear; everyone stays the same Korean (East Asian) person as in the image, never a foreigner.";

export const PROMPT_TYPES = [
  {
    id: "hotspring",
    label: "온천·노천탕",
    pattern: /온천|노천|탕|스파|자쿠지|히노끼|욕조/,
    motion: "Locked-off tripod shot, camera does not move; soft steam rises slowly from the hot water and the water surface ripples gently.",
  },
  {
    id: "pool",
    label: "수영장",
    pattern: /수영장|풀|pool|워터파크/i,
    motion: "Locked-off tripod shot, camera does not move; the pool water ripples gently and sunlight sparkles softly on the surface.",
  },
  {
    id: "night",
    label: "야경",
    pattern: /야경|밤|night|조명|루프탑/i,
    motion: "Locked-off tripod shot, camera does not move; the lights twinkle softly and a few clouds drift slowly across the night sky.",
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
    motion: "Almost static camera with an extremely slow, barely noticeable push-in; the sheer curtain sways very gently and daylight shifts softly on the floor.",
  },
  {
    id: "view",
    label: "전경·외관",
    pattern: /전경|외관|건물|입구|마당|정원|한옥|exterior/i,
    motion: "Almost static camera with an extremely slow, barely noticeable push-in; leaves on the trees sway gently in the breeze and clouds drift slowly.",
  },
  {
    id: "nature",
    label: "자연 풍경",
    pattern: /풍경|바다|오션|뷰|산|숲|설경|계곡|노을|해변|view/i,
    motion: "Almost static camera with an extremely slow, barely noticeable push-in; the trees sway gently in the breeze and the clouds drift slowly across the sky.",
  },
  {
    id: "still",
    label: "거의 정지 (기타)",
    pattern: /$^/,
    motion: "Locked-off tripod shot, camera does not move; only the light and shadows shift very slightly, like a living photograph.",
  },
] as const;

export type PromptTypeId = (typeof PROMPT_TYPES)[number]["id"];

const PEOPLE_PATTERN = /사람|인물|가족|커플|아이|부모|친구|모델/;

/** Vague listing names ("CAVERN") fall back to the AI photo group, then to the safest near-still motion. */
const GROUP_TYPE: Record<string, PromptTypeId> = { water: "hotspring", room: "interior" };

export function detectPromptType(label: string, group?: string): PromptTypeId {
  return PROMPT_TYPES.find((t) => t.pattern.test(label))?.id ?? (group ? GROUP_TYPE[group] : undefined) ?? "still";
}

/** For models that take one (Kling): what must never happen. */
export const NEGATIVE_PROMPT =
  "morphing, warping, melting, bending walls, distorted buildings, distorted furniture, wobbling lines, new objects, extra people, face change, text, watermark, blur, flicker";

export function labelHasPeople(label: string): boolean {
  return PEOPLE_PATTERN.test(label);
}

export function buildVideoPrompt(type: PromptTypeId, withPeople: boolean): string {
  const motion = PROMPT_TYPES.find((t) => t.id === type)?.motion ?? PROMPT_TYPES[0].motion;
  return [motion, withPeople ? SAME_PEOPLE : NO_PEOPLE, KEEP_SCENE].join(" ");
}
