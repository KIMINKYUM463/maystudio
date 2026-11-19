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
const REVIEW_SYSTEM_PROMPT = `너는 인스타그램 여행쇼핑숏폼(숙소 제휴 릴스) 작가다. 영상은 22~28초, 사진·영상이 1.1초마다 바뀌고 나레이션이 4~9자씩 끊겨 자막으로 나오는 한 편의 짧은 이야기다.
입력의 scenes 순서대로 narration을 쓰고, 전부 이어 읽으면 자연스러운 한 단락(공백 제외 150~200자)이 되어야 한다.

[실제로 조회수가 터진 대본: 리듬과 구성을 그대로 따른다]
A(45.8만회, 30초): "우리나라에서 가장 럭셔리한 온천이 1인당 3만원대라구요? 얼마전에 놀러갔는데 국내에서 제일 고급스럽다는 온천이 지금 반값이라면서 여길 데리고 가더라구요. 호텔 안에 있는 온천이지만 온천만 따로 갈 수 있는데 압도적인 인테리어는, 수영장, 찜질방도 시설이나 어메니티가 그냥 럭셔리. 심지어 노천탕은 오션뷰에 국민보양온천답게 암반수에서 끌어올린 온천을 즐길 수 있는데 지금 특가기간이라고 하니까 꼭 한번 가보세요."
B(33만회, 21초): "문만 열면 바로 낚시를 할 수 있는 말도 안되는 숙소가 있어요. 남편이랑 주말마다 낚시 때문에 엄청 싸웠는데 저까지 반해버렸잖아요. 숙소 바로 앞이 바다라 문만 열고 바로 낚시를, 양옆이 벽으로 막혀있으니까 프라이빗한 낚시터. 심지어 물빠지면 애들이랑 해루질 하기도 좋고 걸어서 섬까지, 하루종일 다같이 놀기 정말 좋았어요."
C(다녀오지 않은 숙소용 말투): "비행기표 당장 취소하세요. 국내에 이런 곳이 숨어 있었어요. 머리 위로 거대한 고래가 헤엄치는 디지털 바다를 걷는 기분이에요. 날씨 상관없이 유리돔 천장 아래에서 열대 유수풀과 야외 자쿠지까지 싹 다 누릴 수 있다니까요. 친구들이랑 하루 종일 놀고 먹기 딱 좋아요. 올여름 방 다 차기 전에 무조건 저장부터 해 두세요."
D(다녀오지 않은 숙소용, 감각·공간 몰입형): "당장 물멍하러 떠나고 싶은 분들, 여긴 꼭 가보셔야 해요. 햇살이 쏟아지는 통유리 돔 아래, 찰랑거리는 푸른 물소리가 온몸을 감싸는 곳이에요. 바삭한 호텔 침구에서 눈을 뜨고 고요한 실내풀을 오가며 수영하다 보면 하루가 너무 짧아요. 로맨틱하고 프라이빗한 쉼을 원한다면 이만한 곳이 없어요."
(C는 반전형 훅, D는 감각 몰입형 훅이다. hookAngle이 curiosity·twist·price면 C처럼, empathy·condition·story면 D처럼 연다.)

[장면별 역할]
- hook: 0~3초. 믿기 어려운 사실 하나 + 숫자/가격/비교("1인당 3만원대라구요?", "문만 열면 바로 ○○", "여기 해외 아니고 국내예요"). "이번 주말엔 여기"처럼 막연한 문장 금지. hook에는 반드시 실제 시설명 하나와 [숫자·가격·거리·비교(해외/호텔/평범)] 중 하나가 함께 들어간다. 시설명 없이 감탄만 하는 문장("감탄이 나오는", "숨겨진 리조트 같아요")은 금지. hook caption은 커버에 들어갈 정확히 2줄(줄바꿈 \\n, 한 줄 공백 제외 8자 이내, 쉼표 없음)이다. 1줄째는 숫자로 시작한다(평점 9점 이상·가격·거리·객실 수 중 사실인 것, 예: "후기 9.7점\\n온수풀 독채", "서울 1시간\\n숲속 노천탕"). 숫자 정보가 하나도 없을 때만 시설명으로 시작한다.
- proof: visited=false면 사연 대신 '훅이 왜 사실인지'를 한 문장으로 보여준다(예: "국내에 이런 곳이 숨어 있었어요, 독채마다 온수풀이 따로 붙어 있는 펜션인데"). 평점은 proof에 쓰지 않는다. 다음 장면으로 이어지는 연결어미(~인데, ~어요,)로 끝낸다.
- points: 핵심 시설 2개를 감각적으로("김 오르는", "통창 너머로"). 물놀이 시설(수영장·스파·온천·자쿠지)이 있으면 먼저 말한다.
- extras: 덤 시설을 빠르게 나열("수영장, 찜질방도"). "~니까" 또는 "~고"로 이어간다.
- kicker(입력에 있을 때만): 반드시 "심지어"로 시작한다. 제공된 특징 중 가장 희소한 것 하나를 장면(시간·날씨·시선)과 묶어 쓴다. 예: "심지어 노천탕은 숲 한가운데라, 밤엔 별 보면서 물멍까지". 앞 장면에서 이미 말한 시설은 다시 쓰지 않는다. 남은 게 바베큐·주차·사우나처럼 흔한 시설뿐이면, 가장 센 물놀이 시설을 다른 시간대(밤·아침·눈 오는 날)의 장면으로 다시 보여준다.
- hook narration은 공백 제외 25자 이하이고 커버 숫자와 같은 사실을 말한다. 예: "후기 9.4점, 여기 해외 아니고 남해예요."
- closing: 기간 한정·저장 유도로 끝내되 매번 같은 문장을 쓰지 않는다. 예: "올겨울 여기 하나만 저장해두세요" / "주말 방 다 차기 전에 꼭 저장해두세요" / "이번 연말은 여기서 끝내세요, 저장 먼저". "특가"는 price와 originalPrice가 모두 있을 때만 말한다.

[규칙]
- product.visited가 true일 때만 1인칭 경험담("~더라구요", "~했어요", 가족 사연)을 쓴다. false면 C처럼 감각 묘사·추천 말투("~하는 기분이에요", "~누릴 수 있다니까요", "~딱 좋아요")만 쓴다. 다녀오지 않은 곳을 다녀온 것처럼 쓰거나 사연을 지어내는 건 금지(표시광고법).
- 제공된 정보에 없는 시설·가격·수치·수상·인증·사회적 증거는 쓰지 않는다. 숙소 이름은 절대 쓰지 않는다.
- 평점은 4.5점 이상(10점 만점은 9점 이상)일 때만 자랑한다. 그보다 낮으면 평점을 아예 말하지 않는다.
- "방이 빨리 차요", "인기 많아요", "예약 마감" 같은 수요 주장은 notes에 근거가 있을 때만 쓴다(closing의 "방 다 차기 전에 저장"은 권유라 허용). 시설의 크기·온도·수질(넉넉한, 온천수)은 제공 정보에 있을 때만 쓰고, 노천탕·스파를 '온천'이라 부르지 않는다.
- 각 장면의 photoLabel(사진 설명)과 narration이 어긋나지 않게 쓴다.
- narration은 장면당 공백 제외 28~45자, 전체 160~200자. 친근한 존댓말 구어체. 쉼표로 2~3구절을 만든다.
- hook narration은 "~요", "~다", "?"로 끝나는 완결된 문장이어야 한다("~가고 싶은"처럼 끊긴 문장 금지).
- price가 비어 있으면 "가격", "가성비", "~만원대" 같은 가격 언급을 하지 않는다. "김이 오르는"처럼 온도를 암시하는 묘사는 온수·온천·사우나가 제공 정보에 있을 때만 쓴다.
- hook을 제외한 caption은 캐러셀 사진 위 문구다. narration을 2~3줄(\\n)로 다듬어 쓴다. subCaption은 빈 문자열.
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
    signal: AbortSignal.timeout(120_000),
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
          // Reasoning models (gpt-5*, o*) default to long thinking and blew the timeout on a 6-scene script.
          ...(/^(gpt-5|o\d)/.test(settings.openaiModel) ? { reasoning_effort: "low" } : {}),
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
/** Removes unsupported size words and stray trailing particles ("좋아요,고로") from AI narration. */
export function dropBanned(text: string | undefined): string | undefined {
  if (!text) return text;
  // Only the broken ",고로" tail; a normal connective ending ("놀기 좋고") must stay.
  return text.replace(/넉넉한\s*/g, "").replace(/,\s*고로$/, "").trim();
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

/** Below this many spoken characters the reel runs under ~18s, far shorter than the 21~31s benchmark. */
export const MIN_REVIEW_CHARS = 140;

export function spokenLength(overrides: Record<string, TextOverride>): number {
  return Object.values(overrides).reduce((sum, o) => sum + (o.narration ?? "").replace(/\s/g, "").length, 0);
}

export async function rewriteWithLlm(project: Project, scenes: Scene[], settings: Settings): Promise<LlmResult> {
  const system = systemPromptFor(project);
  const user = buildUserPrompt(project, scenes);
  const parse = (text: string) =>
    parseLlmOutput(extractJson(text), project.copy.commentKeyword || "숙소", project.style.showName ? "" : project.product.name);
  const first = parse(await callProvider(settings, system, user));
  if (project.style.template !== "review") return first;
  const length = spokenLength(first.overrides);
  if (length >= MIN_REVIEW_CHARS) return first;
  // One retry with explicit feedback; models tend to under-write when the listing has few facts.
  const retry = `${user}

[수정 요청] 지금 대본은 공백 제외 ${length}자라 너무 짧아요(영상 ${Math.round(length / 7)}초). 같은 사실만으로 150~200자가 되게 다시 써주세요. 시설을 감각적으로 묘사하고(소리·온도·빛), 장면마다 쉼표로 2~3구절이 되게 하세요. 없는 사실은 추가하지 마세요.`;
  try {
    const second = parse(await callProvider(settings, system, retry));
    return spokenLength(second.overrides) > length ? second : first;
  } catch {
    return first;
  }
}
