import { describe, expect, it } from "vitest";
import {
  buildCopy,
  buildHashtags,
  COUPANG_DISCLOSURE,
  fillDmLink,
  hasDisclosureFirst,
  LINK_PLACEHOLDER,
  MAX_HASHTAGS,
} from "@/lib/script/copy";
import { generateScript } from "@/lib/script/generator";
import { buildVideoProps, FPS, sceneDurationSec, totalDurationInFrames, TRANSITION_FRAMES } from "@/lib/video/props";
import { sampleProject } from "./fixtures";

describe("copy", () => {
  const project = sampleProject();
  const { product } = project;
  const coupang = { ...project, product: { ...product, platform: "coupang" as const } };

  it("opens with a disclosure, hides the stay name and ends with the keyword", () => {
    const copy = buildCopy(project, "강릉에서 1박 8만원대?\n이 퀄리티 실화", "쉼");
    const lines = copy.caption.split("\n");
    expect(hasDisclosureFirst(copy.caption)).toBe(true);
    expect(lines[1]).toBe("강릉에서 1박 8만원대? 이 퀄리티 실화");
    expect(lines.at(-1)).toContain("'쉼'");
    expect(copy.caption).not.toContain(product.name);
    expect(copy.pinnedComment).toContain("'쉼'");
  });

  it("uses Coupang's exact Partners sentence as the first caption line", () => {
    const { caption, dmTemplate } = buildCopy(coupang, "훅", "쉼");
    expect(caption.split("\n")[0]).toBe(COUPANG_DISCLOSURE);
    expect(dmTemplate).toContain(COUPANG_DISCLOSURE);
  });

  it("shows the name in the caption only when showName is on", () => {
    const shown = { ...project, style: { ...project.style, showName: true } };
    expect(buildCopy(shown, "훅", "쉼").caption).toContain(product.name);
  });

  it("detects a caption whose first line lost its disclosure", () => {
    expect(hasDisclosureFirst("훅\n[광고] ...")).toBe(false);
    expect(hasDisclosureFirst(`  ${COUPANG_DISCLOSURE}\n훅`)).toBe(true);
  });

  it("limits hashtags to unique, space-free tags", () => {
    const tags = buildHashtags(product, "deal");
    expect(tags.length).toBeLessThanOrEqual(MAX_HASHTAGS);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags.every((t) => !/[\s#]/.test(t))).toBe(true);
    expect(tags[0]).toBe("강원숙소");
  });

  it("DM reveals the name, discloses the affiliate link and fills the placeholder", () => {
    const { dmTemplate } = buildCopy(project, "훅", "숙소");
    expect(dmTemplate).toContain("오션뷰 감성 스테이예요");
    expect(dmTemplate).toContain(LINK_PLACEHOLDER);
    expect(dmTemplate).toContain("#광고");
    expect(fillDmLink(dmTemplate, "https://x.test/go/1")).toContain("https://x.test/go/1");
    expect(dmTemplate).not.toMatch(/\n\n\n/);
  });
});

describe("video props", () => {
  const base = sampleProject();
  const project = { ...base, scenes: generateScript(base, 1).scenes };

  it("resolves asset files to URLs and keeps scene order", () => {
    const props = buildVideoProps(project, (f) => `http://h/${f}`);
    expect(props.scenes[0].shots).toEqual([{ imageSrc: "http://h/assets/a1.jpg", videoSrc: null }]);
    expect(props.scenes.map((s) => s.id)).toEqual(project.scenes.map((s) => s.id));
    expect(props.bgmSrc).toBeNull();
  });

  it("turns a scene's extra photos into shots and plays AI clips in place of photos", () => {
    const withClip = {
      ...project,
      assets: project.assets.map((a) => (a.id === "a2" ? { ...a, videoFile: "assets/a2-clip.mp4" } : a)),
      scenes: [{ ...project.scenes[1], assetId: "a2", extraAssetIds: ["a3", "missing"] }],
    };
    const [scene] = buildVideoProps(withClip, (f) => f).scenes;
    expect(scene.shots).toEqual([
      { imageSrc: "assets/a2.jpg", videoSrc: "assets/a2-clip.mp4" },
      { imageSrc: "assets/a3.jpg", videoSrc: null },
    ]);
  });

  it("stretches a scene to fit its narration only when a voice is enabled", () => {
    const scene = { ...project.scenes[0], durationSec: 2, audioFile: "audio/a.mp3", audioDurationSec: 3 };
    expect(sceneDurationSec(scene, false)).toBe(2);
    expect(sceneDurationSec(scene, true)).toBeCloseTo(3.35);
    const voiced = { ...project, voice: { ...project.voice, provider: "openai" as const }, scenes: [scene] };
    const props = buildVideoProps(voiced, (f) => f);
    expect(props.scenes[0].audioSrc).toBe("audio/a.mp3");
    expect(props.scenes[0].durationInFrames).toBe(Math.round(sceneDurationSec(scene, true) * FPS));
  });

  it("subtracts transition overlap from the total length", () => {
    const scenes = [{ durationInFrames: 60 }, { durationInFrames: 60 }, { durationInFrames: 60 }];
    expect(totalDurationInFrames(scenes)).toBe(180 - 2 * TRANSITION_FRAMES);
    expect(totalDurationInFrames([])).toBe(FPS);
  });
});
