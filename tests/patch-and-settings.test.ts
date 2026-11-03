import { describe, expect, it } from "vitest";
import { applyProjectPatch } from "@/lib/project-patch";
import { generateScript } from "@/lib/script/generator";
import { MASK, maskSettings, mergeSettings, replicateReady } from "@/lib/settings-view";
import { patchOf, projectPatchSchema, settingsSchema } from "@/lib/types";
import { sampleProject } from "./fixtures";

describe("project patch", () => {
  const base = sampleProject();
  const project = { ...base, scenes: generateScript(base, 1).scenes };

  it("a partial product patch keeps the other fields (regression: zod partial filled defaults)", () => {
    const patch = projectPatchSchema.parse({ product: { name: "새 이름" } });
    expect(patch.product).toEqual({ name: "새 이름" });
    const next = applyProjectPatch(project, patch);
    expect(next.product.name).toBe("새 이름");
    expect(next.product.region).toBe("강원 강릉");
    expect(next.product.features).toEqual(base.product.features);
  });

  it("reorders and relabels assets, ignoring unknown ids and keeping omitted ones", () => {
    const next = applyProjectPatch(project, { assets: [{ id: "a3", label: "침실" }, { id: "zzz" }, { id: "a1" }] });
    expect(next.assets.map((a) => a.id)).toEqual(["a3", "a1", "a2", "a4", "a5"]);
    expect(next.assets[0]).toMatchObject({ label: "침실", file: "assets/a3.jpg", width: 1200 });
  });

  it("never trusts client audio paths and drops audio when narration changes", () => {
    const voiced = {
      ...project,
      scenes: project.scenes.map((s) => ({ ...s, audioFile: `audio/${s.id}.mp3`, audioDurationSec: 2 })),
    };
    const sent = voiced.scenes.map((s, i) => ({
      ...s,
      audioFile: "../../../secret.mp3",
      narration: i === 0 ? "바뀐 나레이션" : s.narration,
    }));
    const next = applyProjectPatch(voiced, { scenes: sent });
    expect(next.scenes[0].audioFile).toBeUndefined();
    expect(next.scenes[1].audioFile).toBe(`audio/${voiced.scenes[1].id}.mp3`);
  });

  it("nulls scene asset references that no longer exist", () => {
    const next = applyProjectPatch(project, { scenes: [{ ...project.scenes[0], assetId: "deleted" }] });
    expect(next.scenes[0].assetId).toBeNull();
  });
});

describe("settings", () => {
  const stored = settingsSchema.parse({ openaiKey: "sk-abcdefghijklmnop", instagramHandle: "@me" });

  it("never returns raw secrets", () => {
    const masked = maskSettings(stored);
    expect(masked.openaiKey).toBe(`sk-${MASK}mnop`);
    expect(masked.configured.openaiKey).toBe(true);
    expect(masked.configured.elevenlabsKey).toBe(false);
    expect(masked.configured.replicateKey).toBe(false);
  });

  it("masks a Replicate token and reports when image-to-video is ready", () => {
    const withKey = settingsSchema.parse({ replicateKey: "r8_abcdefghijklmnop" });
    const masked = maskSettings(withKey);
    expect(masked.replicateKey).toBe(`r8_${MASK}mnop`);
    expect(masked.configured.replicateKey).toBe(true);
    expect(replicateReady(masked)).toBe(true);
    expect(replicateReady(maskSettings(settingsSchema.parse({})))).toBe(false);
    expect(mergeSettings(withKey, { replicateKey: "" }).replicateKey).toBe("");
  });

  it("partial settings PUT does not reset unspecified keys", () => {
    const patch = patchOf(settingsSchema).parse({ instagramHandle: "@new" });
    expect(patch).toEqual({ instagramHandle: "@new" });
    const next = mergeSettings(stored, patch);
    expect(next.openaiKey).toBe("sk-abcdefghijklmnop");
    expect(next.instagramHandle).toBe("@new");
  });

  it("keeps the key when the mask is echoed back and clears it on empty string", () => {
    expect(mergeSettings(stored, { openaiKey: `sk-${MASK}mnop` }).openaiKey).toBe("sk-abcdefghijklmnop");
    expect(mergeSettings(stored, { openaiKey: "" }).openaiKey).toBe("");
  });
});
