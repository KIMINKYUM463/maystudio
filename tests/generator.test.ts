import { describe, expect, it } from "vitest";
import { availableHooks, fillTemplate, HOOK_LIBRARY, HOOK_SLOTS } from "@/lib/script/hooks";
import {
  applyTextOverrides,
  cameraForAsset,
  featureMatchesLabel,
  generateScript,
  shortPrice,
  shortRegion,
  swapHook,
} from "@/lib/script/generator";
import { HOOK_ANGLES, MAX_ASSETS, MAX_SCENE_SHOTS, productSchema } from "@/lib/types";
import { buildVideoProps, totalDurationInFrames, FPS } from "@/lib/video/props";
import { asset, sampleProject } from "./fixtures";

describe("shortPrice", () => {
  it("ignores the '1' in '1박' (regression: read as 189,000)", () => {
    expect(shortPrice("1박 89,000원~")).toBe("1박 8만원대");
  });
  it("formats plain prices for stays", () => {
    expect(shortPrice("137,809원", "stay")).toBe("1박 13만원대");
  });
  it("omits '1박' for tours", () => {
    expect(shortPrice("45,000원", "tour")).toBe("4만원대");
  });
  it("keeps non-numeric or small values as typed", () => {
    expect(shortPrice("무료")).toBe("무료");
    expect(shortPrice("USD 120")).toBe("USD 120");
  });
});

describe("hooks", () => {
  it("returns null when a referenced slot is empty", () => {
    expect(fillTemplate("{region}에서 {price}", { region: "강릉" })).toBeNull();
    expect(fillTemplate("{region}에서 {price}", { region: "강릉", price: "1박 8만원대" })).toBe("강릉에서 1박 8만원대");
  });
  it("every angle has at least one slot-free hook so empty products still get a hook", () => {
    for (const angle of HOOK_ANGLES) {
      expect(availableHooks(angle, {}).length, angle).toBeGreaterThan(0);
    }
  });
  it("library templates only use known slots and never the stay name", () => {
    const known = new RegExp(`\\{(${HOOK_SLOTS.join("|")})(:[가-힣]+)?\\}`, "g");
    for (const hooks of Object.values(HOOK_LIBRARY)) {
      for (const h of hooks) {
        expect(h.caption.replace(known, "")).not.toMatch(/[{}]/);
        expect(h.narration.replace(known, "")).not.toMatch(/[{}]/);
      }
    }
  });
  it("attaches the right 조사 to filled slots", () => {
    expect(fillTemplate("{target:이랑} {occasion:은}", { target: "아이", occasion: "겨울 온천" })).toBe("아이랑 겨울 온천은");
    expect(fillTemplate("{target:이랑} {occasion:은}", { target: "부모님", occasion: "연말 호캉스" })).toBe(
      "부모님이랑 연말 호캉스는",
    );
  });
});

describe("helpers", () => {
  it("shortRegion keeps the most specific place", () => {
    expect(shortRegion("강원 강릉")).toBe("강릉");
    expect(shortRegion("")).toBe("");
  });
  it("matches features to photo labels by shared words", () => {
    expect(featureMatchesLabel("통창 오션뷰", "오션뷰")).toBe(true);
    expect(featureMatchesLabel("개별 바베큐", "오션뷰")).toBe(false);
  });
  it("matches features to photos of the same kind of space", () => {
    expect(featureMatchesLabel("스파 욕조", "욕실")).toBe(true);
    expect(featureMatchesLabel("프라이빗 풀", "수영장")).toBe(true);
    expect(featureMatchesLabel("스파 욕조", "")).toBe(false);
  });
  it("pans landscape photos and tilts/zooms portrait ones", () => {
    expect(cameraForAsset(asset("x", "", 1600, 900), 1)).toMatch(/^pan-/);
    expect(["tilt-up", "push-in"]).toContain(cameraForAsset(asset("x", "", 900, 1600), 1));
  });
});

describe("generateScript", () => {
  const project = sampleProject();

  it("follows the kit's five beats with at most two selling points", () => {
    const { scenes } = generateScript(project, 1);
    expect(scenes.map((s) => s.kind)).toEqual(["hook", "feature", "feature", "romance", "outro", "cta"]);
    expect(scenes[0].assetId).toBe("a1");
    expect(scenes[0].extraAssetIds).toEqual([]);
  });

  it("keeps the stay name out of every scene unless showName is on", () => {
    for (let seed = 0; seed < 20; seed++) {
      const text = generateScript(project, seed).scenes.map((s) => `${s.caption} ${s.subCaption} ${s.narration}`).join(" ");
      expect(text).not.toContain(project.product.name);
    }
    const shown = { ...project, style: { ...project.style, showName: true } };
    expect(generateScript(shown, 1).scenes[0].subCaption).toContain(project.product.name);
  });

  it("deals leftover photos as quick cuts so every photo is used", () => {
    const many = sampleProject({ assets: Array.from({ length: MAX_ASSETS }, (_, i) => asset(`p${i}`, "")) });
    const { scenes } = generateScript(many, 1);
    const used = scenes.flatMap((s) => [s.assetId, ...s.extraAssetIds]);
    expect(new Set(used).size).toBe(MAX_ASSETS);
    expect(scenes[0].extraAssetIds).toEqual([]);
    expect(scenes.every((s) => s.extraAssetIds.length < MAX_SCENE_SHOTS)).toBe(true);
    for (const s of scenes) expect(s.durationSec / (1 + s.extraAssetIds.length)).toBeGreaterThanOrEqual(1);
    const seconds = totalDurationInFrames(buildVideoProps({ ...many, scenes }, (f) => f).scenes) / FPS;
    expect(seconds).toBeLessThanOrEqual(25);
  });

  it("puts the outro extras after the two selling points", () => {
    const four = sampleProject({ product: { ...project.product, features: ["A", "B", "온천/스파", "D"] } });
    expect(generateScript(four, 1).scenes.find((s) => s.kind === "outro")?.subCaption).toBe("+ 온천 · D");
  });

  it("is deterministic for a seed and fills every slot", () => {
    const a = generateScript(project, 42).scenes;
    expect(generateScript(project, 42).scenes).toEqual(a);
    for (const s of a) expect(s.caption).not.toMatch(/[{}]/);
  });

  it("puts a matching feature on the matching photo (regression: 바베큐 on 오션뷰)", () => {
    const { scenes } = generateScript(project, 3);
    expect(scenes.find((s) => s.caption === "통창 오션뷰")?.assetId).toBe("a2");
    expect(scenes.find((s) => s.caption === "개별 바베큐")?.assetId).not.toBe("a2");
  });

  it("CTA carries the comment keyword used by DM automation", () => {
    const custom = { ...project, copy: { ...project.copy, commentKeyword: "강릉" } };
    const cta = generateScript(custom, 1).scenes.at(-1);
    expect(cta?.kind).toBe("cta");
    expect(cta?.caption).toBe("정보는 댓글에\n'강릉' 남겨주세요");
  });

  it("never uses the long region form in the hook", () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(generateScript(project, seed).scenes[0].caption).not.toContain("강원 강릉");
    }
  });

  it("works with no photos and an empty product", () => {
    const empty = sampleProject({ assets: [], product: productSchema.parse({}) });
    const { scenes } = generateScript(empty, 5);
    expect(scenes.map((s) => s.kind)).toEqual(["hook", "feature", "romance", "outro", "cta"]);
    expect(scenes.every((s) => s.assetId === null)).toBe(true);
    for (const s of scenes) expect(s.caption.trim()).not.toBe("");
  });

  it("keeps the video in the kit's 18–25s range", () => {
    const scripted = { ...project, scenes: generateScript(project, 1).scenes };
    const seconds = totalDurationInFrames(buildVideoProps(scripted, (f) => f).scenes) / FPS;
    expect(seconds).toBeGreaterThanOrEqual(18);
    expect(seconds).toBeLessThanOrEqual(25);
  });

  it("swapHook changes only the hook and moves to another angle", () => {
    const scenes = generateScript(project, 1).scenes.map((s) => ({ ...s, audioFile: "audio/x.mp3", audioDurationSec: 2 }));
    const swapped = swapHook({ ...project, scenes }, 9);
    expect(swapped.hookAngle).not.toBe(project.hookAngle);
    expect(swapped.scenes[0].caption).not.toBe(scenes[0].caption);
    expect(swapped.scenes[0].audioFile).toBeUndefined();
    expect(swapped.scenes.slice(1)).toEqual(scenes.slice(1));
  });

  it("applies AI text overrides by scene id without touching structure", () => {
    const { scenes } = generateScript(project, 1);
    const next = applyTextOverrides(scenes, { hook: { caption: "새 훅", narration: "새 나레이션" } });
    expect(next[0]).toMatchObject({ caption: "새 훅", narration: "새 나레이션", camera: scenes[0].camera });
    expect(next.slice(1)).toEqual(scenes.slice(1));
  });
});
