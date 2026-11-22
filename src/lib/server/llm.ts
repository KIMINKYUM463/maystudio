import { z } from "zod";
import { MAX_HASHTAGS, normalizeTag } from "../script/copy";
import type { TextOverride } from "../script/generator";
import {
  buildMayUserPrompt,
  cleanScript,
  distributeScript,
  MAY_MAX_CHARS,
  MAY_POLISH_PROMPT,
  MAY_SHORTEN_PROMPT,
  MAY_SYSTEM_PROMPT,
  scriptChars,
} from "../script/may-prompt";
import type { Project, Scene, Settings } from "../types";

const llmOutputSchema = z.object({
  scenes: z
    .array(
      z.object({
        id: z.string(),
        caption: z.string().optional(),
        subCaption: z.string().optional(),
        narration: z.string().optional(),
      }),
    )
    .min(1),
  hashtags: z.array(z.string()).optional(),
});

/** `drop`: scene ids left without a line by a short one-paragraph script (removed by the caller). */
export type LlmResult = { overrides: Record<string, TextOverride>; hashtags: string[]; drop?: string[] };

const SYSTEM_PROMPT = `너는 인스타그램 여행쇼츠(숙소 제휴 릴스) 전문 카피라이터다. 숙소를 고르고 결제하는 30~50대 여성이 "여기 가고 싶다", "여기 어디지?" 하고 댓글을 남기게 만든다.
여행쇼츠는 '필요'가 아니라 '로망'을 판다. 대본은 18~25초, 5단계다: hook(후킹) → feature(소구점) → romance(로망) → outro(덤·여운) → cta(댓글 키워드).
규칙:
- 숙소 이름은 자막·나레이션 어디에도 쓰지 않는다. 궁금해야 댓글이 달린다.
- hook: 숙소 소개("어디에 있는 이런 숙소예요")로 시작하지 않는다. 보는 사람의 상황이나 예상 밖의 한 가지로 시작한다. 조건형("아이랑 겨울 온천은 무조건 여기 가세요"), 대조형("한옥인데 노천탕에 진심인 곳"), 궁금증형, 공감형, 숫자형("서울에서 1시간, 눈 오는 노천탕"), 반전형, 이야기형, 귀띔형 중 hookAngle에 맞춘다. 2줄 이내(줄바꿈은 \\n), 한 줄 12자 내외.
- feature: 이 숙소에만 있는 소구점 한 가지를 14자 이내로. 시설을 나열하지 않는다.
- romance: 특징 → 좋은 점 → 그 자리에 있는 장면(FAB)으로 바꾼 로망 문장 하나. 예: 객실 전용 노천탕 → "눈치 볼 사람 없이 둘이 김 오르는 물에 앉아 있으면 시간 가는 줄 몰라요". 제작자가 직접 다녀온 척하는 후기체("제가 가봤는데")는 쓰지 않는다.
- outro: 덤(부가 혜택)과 감정으로 마무리. subCaption은 덤 요약.
- cta: caption에 댓글 키워드를 반드시 작은따옴표로 감싸 넣는다. 예: 정보는 댓글에\\n'쉼' 남겨주세요
- notes(리뷰·자주 묻는 질문)에 나온 걱정("아이랑 가도 돼요?")에 미리 답하면 좋다.
- 모든 문장은 제공된 정보에서 확인되는 사실 위에 쓴다. 없는 시설·가격·수치·최저가·100% 같은 과장은 금지.
- narration은 친근한 존댓말 구어체, 장면당 40자 이내.
- hashtags는 # 없이 최대 ${MAX_HASHTAGS}개, 지역/숙소유형/타깃 중심.
반드시 다음 JSON만 출력: {"scenes":[{"id":"...","caption":"...","subCaption":"...","narration":"..."}],"hashtags":["..."]}`;

export function buildUserPrompt(project: Project, scenes: Scene[]): string {
  const labels = new Map(project.assets.map((a) => [a.id, a.label]));
  const p = project.product;
  return JSON.stringify(
    {
      product: {
        nameNeverShowInVideo: p.name,
        stayType: p.stayType,
        region: p.region,
        access: p.access,
        occasion: p.occasion,
        price: p.priceText,
        originalPrice: p.originalPriceText,
        rating: p.rating,
        features: p.features,
        target: p.target,
        notes: p.notes.slice(0, 1500),
        visited: p.visited,
      },
      template: project.style.template,
      hookAngle: project.hookAngle,
      commentKeyword: project.copy.commentKeyword,
      scenes: scenes.map((s) => ({
        id: s.id,
        kind: s.kind,
        photoLabel: s.assetId ? labels.get(s.assetId) ?? "" : "",
        draftCaption: s.caption,
        draftNarration: s.narration,
      })),
    },
    null,
    2,
  );
}

/** Pulls the first JSON object out of a model reply (some wrap it in prose or fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  return JSON.parse(text.slice(start, end + 1));
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`AI 호출 실패 (${res.status}): ${detail}`);
  }
  return res.json();
}

/** `json`: ask for a JSON object (scene rewrite); off for plain-text scripts. */
export async function callProvider(settings: Settings, system: string, user: string, json = true): Promise<string> {
  switch (settings.llmProvider) {
    case "openai": {
      const data = (await postJson(
        "https://api.openai.com/v1/chat/completions",
        {
          model: settings.openaiModel,
          // Reasoning models (gpt-5*, o*) default to long thinking and blew the timeout on a 6-scene script.
          ...(/^(gpt-5|o\d)/.test(settings.openaiModel) ? { reasoning_effort: "low" } : {}),
          ...(json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        { Authorization: `Bearer ${settings.openaiKey}` },
      )) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? "";
    }
    case "anthropic": {
      const data = (await postJson(
        "https://api.anthropic.com/v1/messages",
        { model: settings.anthropicModel, max_tokens: 2000, system, messages: [{ role: "user", content: user }] },
        { "x-api-key": settings.anthropicKey, "anthropic-version": "2023-06-01" },
      )) as { content?: Array<{ type: string; text?: string }> };
      return data.content?.find((c) => c.type === "text")?.text ?? "";
    }
    case "gemini": {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiModel)}:generateContent`;
      const data = (await postJson(
        url,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
        },
        { "x-goog-api-key": settings.geminiKey },
      )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    }
    case "none":
      throw new Error("AI 제공자가 설정되지 않았습니다.");
  }
}

export function hasLlm(settings: Settings): boolean {
  const key = { none: "", openai: settings.openaiKey, anthropic: settings.anthropicKey, gemini: settings.geminiKey }[
    settings.llmProvider
  ];
  return Boolean(key);
}

/** `hiddenName`: the stay name, which must not leak into the video (kit rule 1). */
/** Removes unsupported size words and stray trailing particles ("좋아요,고로") from AI narration. */
export function dropBanned(text: string | undefined): string | undefined {
  if (!text) return text;
  // Only the broken ",고로" tail; a normal connective ending ("놀기 좋고") must stay.
  return text
    .replace(/넉넉한\s*/g, "")
    .replace(/,\s*고로$/, "")
    // Models conjugate ㅎ-irregulars wrong ("그렇는데"); spoken aloud it sounds broken.
    .replace(/(그|이|저)렇는데/g, "$1런데")
    .replace(/(그|이|저)렇은/g, "$1런")
    .trim();
}

export function parseLlmOutput(raw: unknown, keyword: string, hiddenName = ""): LlmResult {
  const parsed = llmOutputSchema.parse(raw);
  const name = hiddenName.trim();
  const clean = (text: string | undefined) => (text && name && text.includes(name) ? undefined : text);
  const overrides: Record<string, TextOverride> = {};
  for (const scene of parsed.scenes) {
    const caption = clean(scene.caption?.replace(/\\n/g, "\n"));
    // Narration is spoken and re-chunked into subtitles; line breaks the model adds would split chunks oddly.
    // Words the prompt bans but models still slip in ("넉넉한" sizes nobody measured), plus odd trailing particles.
    const narration = clean(dropBanned(scene.narration?.replace(/\\n|\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim()));
    const subCaption = clean(scene.subCaption);
    // The CTA must keep the comment keyword or the DM automation won't match.
    if (scene.id === "cta" && caption && !caption.includes(`'${keyword}'`)) {
      overrides[scene.id] = { narration };
      continue;
    }
    overrides[scene.id] = { caption, subCaption, narration };
  }
  const hashtags = [...new Set((parsed.hashtags ?? []).map(normalizeTag).filter(Boolean))].slice(0, MAX_HASHTAGS);
  return { overrides, hashtags };
}

/**
 * 메이 강사님 대본 (review template): one paragraph from her prompt, one read-aloud polish, one shorten
 * pass when it runs past 125 characters, then laid over the scenes sentence by sentence.
 */
async function writeMayScript(project: Project, scenes: Scene[], settings: Settings): Promise<LlmResult> {
  const ask = async (user: string) => cleanScript(await callProvider(settings, MAY_SYSTEM_PROMPT, user, false));
  let script = await ask(buildMayUserPrompt(project));
  if (!script) throw new Error("AI가 대본을 돌려주지 않았습니다.");
  const polished = await ask(`${MAY_POLISH_PROMPT}

${script}`).catch(() => "");
  if (polished) script = polished;
  if (scriptChars(script) > MAY_MAX_CHARS) {
    const shorter = await ask(`${MAY_SHORTEN_PROMPT}

${script}`).catch(() => "");
    if (shorter) script = shorter;
  }
  const name = project.style.showName ? "" : project.product.name.trim();
  if (name && script.includes(name)) throw new Error("AI 대본에 숙소 이름이 들어가서 쓰지 않았어요.");
  const { lines, drop } = distributeScript(dropBanned(script) ?? script, scenes.map((s) => s.id));
  const overrides: Record<string, TextOverride> = {};
  for (const [id, line] of Object.entries(lines)) {
    // The hook keeps its rule-made cover caption (2 short lines); other captions follow the spoken line.
    overrides[id] = id === scenes[0]?.id ? { narration: line } : { narration: line, caption: line.slice(0, 60) };
  }
  return { overrides, hashtags: [], drop };
}

export async function rewriteWithLlm(project: Project, scenes: Scene[], settings: Settings): Promise<LlmResult> {
  if (project.style.template === "review") return writeMayScript(project, scenes, settings);
  const user = buildUserPrompt(project, scenes);
  const raw = await callProvider(settings, SYSTEM_PROMPT, user);
  return parseLlmOutput(extractJson(raw), project.copy.commentKeyword || "숙소", project.style.showName ? "" : project.product.name);
}
