import { describe, expect, it } from "vitest";
import { buildCopy, buildPinnedComment, hookLineFor } from "@/lib/script/copy";
import { hookVars, swapHook } from "@/lib/script/generator";
import { availableHooks, HOOK_SLOTS, REVIEW_HOOK_LIBRARY } from "@/lib/script/hooks";
import { braggableRating, generateReviewScript, proofLine, scriptFor } from "@/lib/script/review";
import { speechSeconds, subtitleChunks, timeChunks, wrapLines } from "@/lib/script/subtitles";
import { HOOK_ANGLES, type Project } from "@/lib/types";
import {
  buildVideoProps,
  CAROUSEL_MAX_SLIDES,
  carouselSlides,
  FPS,
  totalDurationInFrames,
  TRANSITION_FRAMES,
  transitionFramesFor,
  videoDurationInFrames,
} from "@/lib/video/props";
import { asset, sampleProject } from "./fixtures";

function reviewProject(overrides: Partial<Project> = {}): Project {
  const base = sampleProject();
  return {
    ...base,
    style: { ...base.style, template: "review", watermark: "@my_travel" },
    product: {
      ...base.product,
      stayType: "펜션",
      features: ["객실 전용 스파 욕조", "통창 오션뷰", "개별 바베큐", "무료 조식"],
    },
    assets: Array.from({ length: 12 }, (_, i) => asset(`p${i}`, i === 1 ? "오션뷰" : "")),
    ...overrides,
  };
}

const allText = (project: Project) =>
  generateReviewScript(project, 1)
    .scenes.map((s) => `${s.caption} ${s.narration}`)
    .join(" ");

describe("subtitles", () => {
  it("splits narration into short spoken phrases like the benchmark", () => {
    expect(subtitleChunks("사우나를 내 방처럼 쓸 수 있는 숙소가 있어요.")).toEqual(["사우나를", "내 방처럼 쓸 수 있는", "숙소가 있어요."]);
  });
  it("keeps every chunk short enough to read at a glance", () => {
    const text = "방안에 사우나에, 대형 욕조까지 있어서 가족들 다같이 몸 지지기 너무 좋더라구요.";
    for (const chunk of subtitleChunks(text)) expect(chunk.replace(/\s/g, "").length).toBeLessThanOrEqual(9);
    expect(subtitleChunks(text).join(" ")).toBe(text);
  });
  it("times chunks back to back across the whole scene", () => {
    const chunks = timeChunks("사우나를 내 방처럼 쓸 수 있는 숙소가 있어요.", 90);
    expect(chunks[0].from).toBe(0);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].from).toBe(chunks[i - 1].from + chunks[i - 1].durationInFrames);
    }
    const last = chunks.at(-1)!;
    expect(last.from + last.durationInFrames).toBe(90);
    expect(timeChunks("", 90)).toEqual([]);
  });
  it("paces speech at ~7 visible characters per second within scene limits", () => {
    expect(speechSeconds("사우나를 내 방처럼 쓸 수 있는 숙소가 있어요.")).toBeCloseTo(2.7, 1);
    expect(speechSeconds("네")).toBe(1.5);
    expect(speechSeconds("가".repeat(200))).toBe(10);
  });
  it("wraps carousel text at word boundaries", () => {
    expect(wrapLines("후기 평점이 4.8점이나 되는 강릉 펜션인데")).toBe("후기 평점이 4.8점이나\n되는 강릉 펜션인데");
    expect(wrapLines("숲속 노천 온천이 있어서 가족들 다같이 쉬기 딱 좋아요.")).toBe("숲속 노천 온천이 있어서\n가족들 다같이 쉬기 딱 좋아요.");
  });
});

describe("review hooks", () => {
  it("every angle has a slot-free line and only known slots", () => {
    const known = new RegExp(`\\{(${HOOK_SLOTS.join("|")})(:[가-힣]+)?\\}`, "g");
    for (const angle of HOOK_ANGLES) {
      expect(availableHooks(angle, {}, REVIEW_HOOK_LIBRARY).length, angle).toBeGreaterThan(0);
      for (const h of REVIEW_HOOK_LIBRARY[angle]) {
        expect(h.caption.replace(known, "")).not.toMatch(/[{}]/);
        expect(h.narration.replace(known, "")).not.toMatch(/[{}]/);
        expect(h.caption.split("\n").length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("review hook fit", () => {
  it("does not say a view can be used 'like my own room'", () => {
    const view = availableHooks("condition", { feature: "통창 오션뷰" }, REVIEW_HOOK_LIBRARY);
    expect(view.some((h) => /내 방처럼|방안에/.test(h.caption + h.narration))).toBe(false);
    const sauna = availableHooks("condition", { feature: "프라이빗 사우나" }, REVIEW_HOOK_LIBRARY);
    expect(sauna[0].narration).toBe("프라이빗 사우나를 내 방처럼 쓸 수 있는 숙소가 있어요.");
  });
});

describe("generateReviewScript", () => {
  it("builds the benchmark's spoken beats (with a '심지어' kicker) without a CTA scene", () => {
    const { scenes } = generateReviewScript(reviewProject(), 1);
    expect(scenes.map((s) => s.id)).toEqual(["hook", "proof", "points", "extras", "kicker", "closing"]);
    expect(scenes.some((s) => s.kind === "cta" || s.kind === "info")).toBe(false);
    for (const scene of scenes) {
      expect(scene.narration.length).toBeGreaterThan(0);
      expect(scene.durationSec).toBe(speechSeconds(scene.narration));
    }
  });
  it("adds the benchmark's '심지어' beat from a 5th fact, preferring a water facility", () => {
    const project = reviewProject();
    project.product = { ...project.product, features: [...project.product.features, "주차 무료", "야외 노천탕"] };
    const scenes = generateReviewScript(project, 1).scenes;
    expect(scenes.map((s) => s.id)).toEqual(["hook", "proof", "points", "extras", "kicker", "closing"]);
    expect(scenes.find((s) => s.id === "kicker")?.narration).toBe("심지어 야외 노천탕까지 있다니까요.");
    expect(scenes.at(-1)?.narration).toMatch(/저장해두세요\.$/);
  });
  it("opens on a water-facility photo when one is labelled", () => {
    const project = reviewProject({ assets: [asset("room", "객실"), asset("pool", "수영장"), asset("view", "오션뷰")] });
    expect(generateReviewScript(project, 1).scenes[0].assetId).toBe("pool");
  });
  it("runs about as long as the benchmark reels (12~30s)", () => {
    const project = reviewProject();
    const scenes = generateReviewScript(project, 1).scenes;
    const seconds = videoDurationInFrames(buildVideoProps({ ...project, scenes }, (f) => f)) / FPS;
    expect(seconds).toBeGreaterThanOrEqual(12);
    expect(seconds).toBeLessThanOrEqual(30);
  });
  it("tells the selling points as one story: proof, points, extras", () => {
    const { scenes } = generateReviewScript(reviewProject(), 1);
    const byId = Object.fromEntries(scenes.map((s) => [s.id, s.narration]));
    // Not visited: the proof beat says why the hook is true instead of repeating the rating.
    expect(byId.proof).toBe("강릉에 이런 펜션이 숨어 있었어요,");
    expect(byId.points).toContain("에, ");
    expect(byId.points).toContain("까지 있어서");
    expect(byId.extras).toMatch(/까지 있으니까$/);
    expect(byId.kicker).toMatch(/^심지어 /);
    const visited = reviewProject();
    visited.product = { ...visited.product, visited: true };
    expect(generateReviewScript(visited, 1).scenes.find((s) => s.id === "proof")?.narration).toBe("후기 평점이 4.8점이나 되는 강릉 펜션인데");
  });
  it("only speaks in first person when the creator actually stayed there", () => {
    expect(allText(reviewProject())).not.toMatch(/더라구요|하고왔어요/);
    const visited = reviewProject();
    visited.product = { ...visited.product, visited: true };
    expect(allText(visited)).toMatch(/더라구요/);
    expect(allText(visited)).toMatch(/하고왔어요/);
  });
  it("never shows the stay name", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const project = reviewProject();
      const text = generateReviewScript(project, seed).scenes.map((s) => `${s.caption} ${s.narration}`).join(" ");
      expect(text).not.toContain(project.product.name);
    }
  });
  it("cuts about every 1.1s and leaves extra photos for the carousel instead of shortening cuts", () => {
    const project = reviewProject({ assets: Array.from({ length: 20 }, (_, i) => asset(`p${i}`, "")) });
    const scenes = generateReviewScript(project, 1).scenes;
    const used = scenes.flatMap((s) => [s.assetId, ...s.extraAssetIds]).filter(Boolean);
    const seconds = scenes.reduce((sum, s) => sum + s.durationSec, 0);
    expect(seconds / used.length).toBeGreaterThan(0.9);
    expect(used.length).toBeLessThan(project.assets.length);
    expect(new Set(used).size).toBe(used.length);
  });
  it("uses only listing facts as social proof", () => {
    expect(braggableRating("4.8")).toBe("4.8");
    expect(braggableRating("9.2")).toBe("9.2");
    expect(braggableRating("4.1")).toBeNull();
    const plain = { rating: "", stayType: "한옥", region: "경북 경주", occasion: "", visited: true };
    expect(proofLine(plain)).toBe("여기가 바로 경주 한옥인데");
    expect(proofLine({ ...plain, occasion: "겨울 온천 여행" })).toBe("겨울 온천 여행 가기 딱 좋은 경주 한옥인데");
    expect(proofLine({ ...plain, visited: false })).toBe("경주에 이런 한옥이 숨어 있었어요,");
  });
  it("is picked by scriptFor only for the review template", () => {
    const review = reviewProject();
    expect(scriptFor(review, 1).scenes.at(-1)?.id).toBe("closing");
    const emotional = { ...review, style: { ...review.style, template: "emotional" as const } };
    expect(scriptFor(emotional, 1).scenes.some((s) => s.kind === "cta")).toBe(true);
  });
  it("swapping the hook keeps the review voice and re-times the hook", () => {
    const project = reviewProject();
    const scenes = generateReviewScript(project, 1).scenes;
    const swapped = swapHook({ ...project, scenes }, 9);
    const hook = swapped.scenes.find((s) => s.kind === "hook")!;
    const vars = hookVars(project.product);
    const reviewCaptions = HOOK_ANGLES.flatMap((a) => availableHooks(a, vars, REVIEW_HOOK_LIBRARY).map((h) => h.caption));
    expect(reviewCaptions).toContain(hook.caption);
    expect(hook.durationSec).toBe(speechSeconds(hook.narration));
    expect(swapped.scenes.slice(1)).toEqual(scenes.slice(1));
  });
});

describe("review caption", () => {
  const project = reviewProject({ copy: { ...sampleProject().copy, linkNumber: 3 } });
  const scenes = generateReviewScript(project, 1).scenes;
  const { caption, pinnedComment, linkNumber } = buildCopy(project, hookLineFor(scenes, "review"), "쉼");

  it("opens with the ad label and the spoken hook", () => {
    expect(caption.split("\n")[0]).toBe(`[광고] ${scenes[0].narration}😳`);
  });
  it("follows the benchmark layout: story, checks, any-comment DM, numbered profile link, disclosure, tags", () => {
    const order = ["✔️", "한 번쯤은 꼭 가보셨으면 좋겠어요.", "아무 댓글이나", "프로필링크 3번", "🩵 바로가기 : @my_travel", "수수료", "#"];
    const positions = order.map((needle) => caption.indexOf(needle));
    for (const p of positions) expect(p).toBeGreaterThanOrEqual(0);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(caption.match(/✔️/g)).toHaveLength(4);
    expect(linkNumber).toBe(3);
  });
  it("hides the stay name and keeps the non-visited voice", () => {
    expect(caption).not.toContain(project.product.name);
    expect(caption).not.toMatch(/더라고요|좋았어요/);
  });
  it("uses an any-comment pinned comment", () => {
    expect(pinnedComment).toBe(buildPinnedComment("쉼", "review"));
    expect(pinnedComment).toContain("아무 댓글");
  });
});

describe("review video", () => {
  it("uses hard cuts, so scenes do not overlap", () => {
    expect(transitionFramesFor("review")).toBe(0);
    expect(transitionFramesFor("emotional")).toBe(TRANSITION_FRAMES);
    expect(totalDurationInFrames([{ durationInFrames: 60 }, { durationInFrames: 90 }], 0)).toBe(150);
  });
  it("builds a 4:5 carousel: hook cover, story slides, then unused photos", () => {
    const project = reviewProject();
    const props = buildVideoProps({ ...project, scenes: generateReviewScript(project, 1).scenes }, (f) => f);
    const slides = carouselSlides(props);
    expect(slides[0]).toMatchObject({ variant: "cover", text: props.scenes[0].caption });
    expect(slides.length).toBeLessThanOrEqual(CAROUSEL_MAX_SLIDES);
    expect(slides.length).toBeGreaterThanOrEqual(3);
    expect(slides.filter((s) => s.variant === "text").length).toBeLessThanOrEqual(3);
    const images = slides.map((s) => s.imageSrc);
    expect(new Set(images).size).toBe(images.length);
  });
  it("passes the logo and every photo to the composition", () => {
    const project = reviewProject();
    const props = buildVideoProps({ ...project, style: { ...project.style, logoFile: "assets/logo.png" } }, (f) => `/x/${f}`);
    expect(props.logoSrc).toBe("/x/assets/logo.png");
    expect(props.photos).toHaveLength(project.assets.length);
  });
});

describe("new project defaults", () => {
  it("starts on the benchmark template with a keyed voice, Typecast first", async () => {
    const { createEmptyProject } = await import("@/lib/project-factory");
    const none = createEmptyProject("a", "2026-11-19T00:00:00.000Z");
    expect(none.style.template).toBe("review");
    expect(none.voice.provider).toBe("none");
    const keyed = createEmptyProject("b", "2026-11-19T00:00:00.000Z", { geminiKey: "g", typecastKey: "t" });
    expect(keyed.voice.provider).toBe("typecast");
    expect(keyed.voice.voiceId).toMatch(/^tc_/);
  });
});

describe("refitReviewShots", () => {
  it("with too few photos, stretches cuts to ~1.4s and never shows a photo twice in a row", async () => {
    const { refitReviewShots } = await import("@/lib/script/review");
    const project = reviewProject({ assets: Array.from({ length: 4 }, (_, i) => asset(`p${i}`, "")) });
    const scenes = generateReviewScript(project, 1).scenes.map((s) => ({
      ...s,
      narration: "숲속 노천탕과 실내 수영장이 있어서 물소리만으로도 힐링이 되는 곳이에요",
    }));
    const refit = refitReviewShots(scenes, project.assets);
    for (const scene of refit) {
      const shots = [scene.assetId, ...scene.extraAssetIds];
      expect(shots.length).toBe(Math.min(6, Math.max(1, Math.round(scene.durationSec / 1.4))));
      for (let i = 1; i < shots.length; i++) expect(shots[i]).not.toBe(shots[i - 1]);
    }
  });
});

describe("refitReviewShots matching", () => {
  it("puts the photo a line names first, and keeps the hook photo", async () => {
    const { refitReviewShots, narrationMatchScore } = await import("@/lib/script/review");
    expect(narrationMatchScore("심지어 스케이트장까지 있다니까요", "야외 스케이트장")).toBeGreaterThanOrEqual(4);
    expect(narrationMatchScore("방 다 차기 전에 저장해두세요", "객실")).toBe(0);
    const project = reviewProject({
      assets: [asset("pool", "야외수영장"), asset("bed", "침실"), asset("skate", "스케이트장"), asset("bbq", "바베큐장"), asset("view", "오션뷰"), asset("lobby", "라운지")],
    });
    const scenes = generateReviewScript(project, 1).scenes.map((s) =>
      s.id === "kicker" ? { ...s, narration: "심지어 겨울엔 스케이트장까지 있다니까요" } : s,
    );
    const hookPhoto = scenes.find((s) => s.kind === "hook")!.assetId;
    const refit = refitReviewShots(scenes, project.assets);
    expect(refit.find((s) => s.kind === "hook")!.assetId).toBe(hookPhoto);
    const kicker = refit.find((s) => s.id === "kicker");
    if (kicker) expect(kicker.assetId).toBe("skate");
  });
});
