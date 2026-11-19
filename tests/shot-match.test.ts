import { describe, expect, it } from "vitest";
import { applyPicks } from "@/lib/server/shot-match";
import type { Scene } from "@/lib/types";

const scene = (id: string, assetId: string, extra: string[]): Scene => ({
  id, kind: "feature", assetId, extraAssetIds: extra, caption: "", subCaption: "", narration: "", camera: "push-in", durationSec: 3,
});

describe("vision shot picks", () => {
  it("uses the AI's photos per line, keeps the cut count and drops bad numbers", () => {
    const ids = ["bath", "room", "outside", "night"];
    const scenes = [scene("hook", "room", []), scene("proof", "room", ["outside"]), scene("closing", "night", ["room"])];
    const out = applyPicks(scenes, { hook: [0, 1], proof: [2, 2, 9], closing: [] }, ids);
    // The opening photo is the cover and stays, whatever the AI says.
    expect([out[0].assetId, out[0].extraAssetIds]).toEqual(["room", []]);
    // 2 cuts: "outside", then the repeat and the unknown 9 are dropped, filled from the scene's own photos.
    expect([out[1].assetId, out[1].extraAssetIds]).toEqual(["outside", ["room"]]);
    // No picks: the scene keeps its photos.
    expect([out[2].assetId, out[2].extraAssetIds]).toEqual(["night", ["room"]]);
  });
});
