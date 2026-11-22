import type { HookAngle, Project } from "../types";
import { MAY_HOOK_STYLES } from "./may-prompt-data";
import type { ScriptBeat } from "./hook-styles";

export { MAY_HOOK_STYLES, MAY_SYSTEM_PROMPT } from "./may-prompt-data";

/** Longest script allowed, counted without spaces and punctuation (~25s read aloud). */
export const MAY_MAX_CHARS = 125;

export const MAY_POLISH_PROMPT =
  "이 대본을 소리 내어 읽는다고 생각하고, 어색하거나 끊기는 곳을 친구에게 말하듯 고쳐줘. 사실·숫자와 말투(경험담인지 추천인지)는 바꾸지 마. 고친 대본만 출력해.";
export const MAY_SHORTEN_PROMPT = `${MAY_MAX_CHARS}자 이내로 줄여줘(공백·부호 빼고). 사실·숫자는 바꾸지 마. 줄인 대본만 출력해.`;

const SEASON_NAMES: Record<number, string> = {
  1: "겨울",
  2: "늦겨울",
  3: "초봄",
  4: "봄",
  5: "늦봄",
  6: "초여름",
  7: "여름",
  8: "늦여름",
  9: "초가을",
  10: "가을",
  11: "늦가을",
  12: "초겨울",
};

/** "늦가을(11월)": the day the script is written (3~5 spring, 6~8 summer, 9~11 autumn, 12~2 winter). */
export function seasonLine(now = new Date()): string {
  const month = now.getMonth() + 1;
  return `${SEASON_NAMES[month]}(${month}월)`;
}

/** Characters that count toward the 110~125 limit: no spaces, no punctuation. */
export function scriptChars(text: string): number {
  return text.replace(/[\s\p{P}\p{S}]/gu, "").length;
}

/** The user message from her spec: chosen style block, today's season, every stay field, visited flag. */
export function buildMayUserPrompt(project: Pick<Project, "hookAngle" | "product">, now = new Date()): string {
  const s = MAY_HOOK_STYLES[project.hookAngle];
  const p = project.product;
  return [
    `[선택한 훅 스타일] ${s.name}`,
    `공식: ${s.formula}`,
    "유형별 지시문:",
    `훅: ${s.hook}`,
    `몸통: ${s.body}`,
    `끝: ${s.end}`,
    `예시 대본(구조만 참고): ${s.example}`,
    "",
    "[숙소 정보]",
    `오늘 계절: ${seasonLine(now)}`,
    `지역: ${p.region}`,
    `숙소 유형: ${p.stayType}`,
    `추천 대상: ${p.target}`,
    `거리: ${p.access}`,
    `여행 상황: ${p.occasion}`,
    `판매가: ${p.priceText}`,
    `정가: ${p.originalPriceText}`,
    `평점: ${p.rating}`,
    `특징: ${p.features.join(", ")}`,
    `리뷰 메모: ${p.notes.slice(0, 1500).replace(/\s*\n\s*/g, " ")}`,
    `직접 다녀온 숙소: ${p.visited ? "예" : "아니오"}`,
    "",
    "대본 1편만 출력해. 설명·따옴표 없이 대본 문장만.",
  ].join("\n");
}

/** Model replies sometimes wrap the script in quotes, fences or a label; keep the spoken text only. */
export function cleanScript(raw: string): string {
  return raw
    .replace(/```[a-z]*|```/g, "")
    .replace(/^\s*(대본|수정된 대본|고친 대본|줄인 대본)\s*[:：]\s*/u, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/^["“'「]+|["”'」]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Splits one sentence at a spoken joint (~는데, ~니까, ~거든요, ~고, comma) closest to its middle. */
function splitAtJoint(sentence: string): [string, string] | null {
  const joints = [...sentence.matchAll(/(?:는데|니까|거든요|어서|아서|고)(?:,)?\s|,\s/g)];
  if (joints.length === 0) return null;
  const middle = sentence.length / 2;
  const best = joints.reduce((a, b) => (Math.abs(a.index! + a[0].length - middle) < Math.abs(b.index! + b[0].length - middle) ? a : b));
  const at = best.index! + best[0].length;
  const left = sentence.slice(0, at).trim();
  const right = sentence.slice(at).trim();
  return left && right ? [left, right] : null;
}

/**
 * Lays the one-paragraph script over the scene list: the hook sentence on the first scene, the closing
 * sentence on the last, the rest spread in order. Short scripts split sentences at their joints; scenes
 * still left without a line are dropped so no template line survives next to the AI script.
 */
export function distributeScript(script: string, sceneIds: string[]): { lines: Record<string, string>; drop: string[] } {
  const sentences = splitSentences(script);
  if (sentences.length === 0 || sceneIds.length === 0) return { lines: {}, drop: [] };
  if (sceneIds.length === 1) return { lines: { [sceneIds[0]]: sentences.join(" ") }, drop: [] };
  const [hook, ...rest] = sentences;
  const slots = sceneIds.length - 1;
  const pieces = rest.length ? [...rest] : [];
  // Too many sentences: merge the shortest neighbouring pair, keeping the closing sentence on its own.
  if (slots === 1 && pieces.length > 1) pieces.splice(0, pieces.length, pieces.join(" "));
  while (pieces.length > slots) {
    let best = 0;
    for (let i = 1; i < pieces.length - 2; i += 1) {
      if (pieces[i].length + pieces[i + 1].length < pieces[best].length + pieces[best + 1].length) best = i;
    }
    pieces.splice(best, 2, `${pieces[best]} ${pieces[best + 1]}`);
  }
  // Too few: split the longest piece at a spoken joint while that is possible.
  while (pieces.length < slots) {
    const longest = pieces.reduce((iMax, p, i) => (p.length > pieces[iMax].length ? i : iMax), 0);
    const split = pieces.length ? splitAtJoint(pieces[longest]) : null;
    if (!split) break;
    pieces.splice(longest, 1, ...split);
  }
  const lines: Record<string, string> = { [sceneIds[0]]: hook };
  // The last piece always lands on the last scene (the closing); middle scenes take the rest in order.
  const middleIds = sceneIds.slice(1, -1);
  const middlePieces = pieces.slice(0, -1);
  middlePieces.forEach((piece, i) => (lines[middleIds[i]] = piece));
  if (pieces.length) lines[sceneIds[sceneIds.length - 1]] = pieces[pieces.length - 1];
  const drop = sceneIds.filter((id) => !(id in lines));
  return { lines, drop };
}

/** Hook-style dialog beats from her example script, on her fixed timeline for every style. */
export function mayBeats(angle: HookAngle): ScriptBeat[] {
  const s = MAY_HOOK_STYLES[angle];
  // Same splitter as the real script, so a two-sentence example (반전형) still shows four beats.
  const { lines } = distributeScript(s.example, ["hook", "benefit", "points", "closing"]);
  const beats: ScriptBeat[] = [
    { time: "0~2초", role: "훅", line: lines.hook ?? "", why: s.hook },
    { time: "2~11초", role: "혜택", line: lines.benefit ?? "", why: s.body },
    { time: "11~20초", role: "소구점", line: lines.points ?? "", why: "이 숙소만의 소구점을 그곳에서 하는 일로 이어서 말해요." },
    { time: "20~25초", role: "마무리", line: lines.closing ?? "", why: s.end },
  ];
  return beats.filter((beat) => beat.line);
}
