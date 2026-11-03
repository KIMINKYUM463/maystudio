import { z } from "zod";
import { MAX_HASHTAGS, normalizeTag } from "../script/copy";
import type { TextOverride } from "../script/generator";
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

export type LlmResult = { overrides: Record<string, TextOverride>; hashtags: string[] };

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

/** Benchmark voice (@heo.jinny.gogo): one continuous spoken story, shown as chunked subtitles. */
const REVIEW_SYSTEM_PROMPT = `너는 인스타그램 숙소 추천 릴스 작가다. 영상은 15~20초, 사진 위에 나레이션이 몇 글자씩 끊겨 자막으로 나오는 한 편의 짧은 이야기다.
장면은 hook → proof → points → extras → closing 순서이고, 다섯 narration을 이어 읽으면 자연스러운 한 단락이 되어야 한다. 예:
"사우나를 내 방처럼 쓸 수 있는 숙소가 있어요." → "후기 평점이 4.8점이나 되는 한옥 온천호텔인데" → "방안에 사우나에, 대형 욕조까지 있어서 가족들 다같이 몸 지지기 너무 좋더라구요." → "무료 조식도 진짜 맛있고 보드게임도 빌려주니까" → "우리끼리 주말 힐링 제대로 하고왔어요."
규칙:
- hook narration은 보는 사람이 "어디지?" 하게 만드는 한 문장. hook caption은 커버에 들어갈 2줄(줄바꿈 \\n, 한 줄 10자 내외).
- proof·extras는 다음 장면으로 이어지는 연결어미(~인데, ~니까)로 끝낸다. 나머지는 문장으로 끝낸다.
- product.visited가 true일 때만 1인칭 경험담("좋더라구요", "하고왔어요")을 쓴다. false면 추천 말투("딱 좋아요", "해보세요")만 쓴다. 다녀오지 않은 곳을 다녀온 것처럼 쓰는 건 금지.
- 제공된 정보에 없는 사회적 증거("인플루언서들이 다 다녀간", "예약 전쟁")나 지어낸 사연("친구가 티켓을 줘서")은 쓰지 않는다.
- 숙소 이름은 쓰지 않는다. 없는 시설·가격·수치·과장 금지.
- proof·points·extras·closing의 caption은 캐러셀 사진 위 문구다. narration을 2~3줄(\\n)로 다듬어 쓴다.
- narration은 장면당 45자 이내, 친근한 존댓말 구어체. subCaption은 빈 문자열.
- hashtags는 # 없이 최대 ${MAX_HASHTAGS}개, 지역/숙소유형/타깃 중심.
반드시 다음 JSON만 출력: {"scenes":[{"id":"...","caption":"...","subCaption":"","narration":"..."}],"hashtags":["..."]}`;

export function systemPromptFor(project: Pick<Project, "style">): string {
  return project.style.template === "review" ? REVIEW_SYSTEM_PROMPT : SYSTEM_PROMPT;
}

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
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`AI 호출 실패 (${res.status}): ${detail}`);
  }
  return res.json();
}

async function callProvider(settings: Settings, system: string, user: string): Promise<string> {
  switch (settings.llmProvider) {
    case "openai": {
      const data = (await postJson(
        "https://api.openai.com/v1/chat/completions",
        {
          model: settings.openaiModel,
          response_format: { type: "json_object" },
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
          generationConfig: { responseMimeType: "application/json" },
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
export function parseLlmOutput(raw: unknown, keyword: string, hiddenName = ""): LlmResult {
  const parsed = llmOutputSchema.parse(raw);
  const name = hiddenName.trim();
  const clean = (text: string | undefined) => (text && name && text.includes(name) ? undefined : text);
  const overrides: Record<string, TextOverride> = {};
  for (const scene of parsed.scenes) {
    const caption = clean(scene.caption?.replace(/\\n/g, "\n"));
    const narration = clean(scene.narration);
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

export async function rewriteWithLlm(project: Project, scenes: Scene[], settings: Settings): Promise<LlmResult> {
  const text = await callProvider(settings, systemPromptFor(project), buildUserPrompt(project, scenes));
  return parseLlmOutput(
    extractJson(text),
    project.copy.commentKeyword || "숙소",
    project.style.showName ? "" : project.product.name,
  );
}
