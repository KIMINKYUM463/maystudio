import { describe, expect, it } from "vitest";
import { creditLine } from "@/lib/script/copy";
import { insertCut, licenseLabel, placeQuery } from "@/lib/server/scenery";
import type { Scene } from "@/lib/types";

const scene = (extra: string[]): Scene => ({
  id: "proof",
  kind: "feature",
  assetId: "a",
  extraAssetIds: extra,
  caption: "",
  subCaption: "",
  narration: "",
  camera: "push-in",
  durationSec: 3,
});

describe("free scenery", () => {
  it("slots the scenery into the middle of a scene's cuts, never first, within the shot limit", () => {
    expect(insertCut(scene([]), "s").extraAssetIds).toEqual(["s"]);
    expect(insertCut(scene(["b", "c"]), "s").extraAssetIds).toEqual(["b", "s", "c"]);
    const full = insertCut(scene(["b", "c", "d", "e", "f"]), "s");
    expect(full.assetId).toBe("a");
    expect(full.extraAssetIds).toHaveLength(5);
    expect(full.extraAssetIds).toContain("s");
  });

  it("builds a fallback query from the region and labels licences", () => {
    expect(placeQuery("강원 강릉시")).toBe("Gangneung landscape");
    expect(placeQuery("제주")).toBe("Jeju landscape");
    expect(placeQuery("어딘가")).toBeNull();
    expect(licenseLabel("by-sa", "4.0")).toBe("CC BY-SA 4.0");
    expect(licenseLabel("cc0", "1.0")).toBe("CC0");
  });

  it("credits only the free photos the reel actually shows", () => {
    const assets = [
      { id: "a", label: "수영장", group: "water" as const },
      { id: "s", label: "풍경", group: "other" as const, credit: { title: "t", author: "Kim", license: "CC BY 2.0", url: "u" } },
      { id: "x", label: "풍경", group: "other" as const, credit: { title: "t", author: "Lee", license: "CC0", url: "u" } },
    ];
    const scenes = [{ id: "proof", narration: "", assetId: "a", extraAssetIds: ["s"] }];
    expect(creditLine({ assets, scenes })).toBe("📷 풍경 사진: Kim (CC BY 2.0) · Openverse");
    expect(creditLine({ assets: assets.slice(0, 1), scenes })).toBe("");
  });
});

describe("scenery pick", () => {
  it("prefers titles naming the subject and skips buildings, people and close-ups", async () => {
    const { bestScenery } = await import("@/lib/server/scenery");
    const results = [
      { title: "Frost on window", url: "1" },
      { title: "Forest resort hotel", url: "2" },
      { title: "Misty pine forest at dawn", url: "3" },
    ];
    expect(bestScenery(results, "pine forest", new Set())?.url).toBe("3");
    expect(bestScenery(results, "pine forest", new Set(["3"]))).toBeUndefined();
  });
});
