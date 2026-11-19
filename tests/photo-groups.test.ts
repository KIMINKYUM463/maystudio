import { describe, expect, it } from "vitest";
import { applyPhotoClasses, groupCounts, isGenericLabel } from "@/lib/photo-groups";
import { asset } from "./fixtures";

describe("applyPhotoClasses", () => {
  const assets = [asset("lobby", "전경"), asset("bed", "객실"), asset("pool", ""), asset("mine", "내가 쓴 이름"), asset("view", "기본")];
  const classes = [
    { index: 0, label: "로비", group: "other" as const, score: 2 },
    { index: 1, label: "침실", group: "room" as const, score: 3 },
    { index: 2, label: "야외수영장", group: "water" as const, score: 5 },
    { index: 3, label: "노천탕", group: "water" as const, score: 3 },
    { index: 4, label: "오션뷰", group: "signature" as const, score: 4 },
  ];

  it("orders water, signature, room, other, best first", () => {
    expect(applyPhotoClasses(assets, classes).map((a) => a.id)).toEqual(["pool", "mine", "view", "bed", "lobby"]);
  });
  it("replaces generic labels but keeps what the user typed", () => {
    const labels = Object.fromEntries(applyPhotoClasses(assets, classes).map((a) => [a.id, a.label]));
    expect(labels).toEqual({ pool: "야외수영장", mine: "내가 쓴 이름", view: "오션뷰", bed: "침실", lobby: "로비" });
  });
  it("keeps photos the AI skipped, at the end in their old order", () => {
    expect(applyPhotoClasses(assets, classes.slice(2, 3)).map((a) => a.id)).toEqual(["pool", "lobby", "bed", "mine", "view"]);
  });
  it("counts groups for the 3·2·2 checklist", () => {
    expect(groupCounts(classes)).toEqual({ water: 2, signature: 1, room: 1, other: 1 });
  });
  it("treats importer placeholders as generic", () => {
    expect(isGenericLabel("전경")).toBe(true);
    expect(isGenericLabel("노천탕")).toBe(false);
  });
});

describe("featuresFromPhotos", () => {
  it("tops up thin listings with water/signature photo names, skipping covered and generic ones", async () => {
    const { featuresFromPhotos } = await import("@/lib/photo-groups");
    const out = featuresFromPhotos(["야외수영장", "바베큐"], [
      { label: "수영장", group: "water" },
      { label: "히노끼 욕조", group: "water" },
      { label: "대표 사진", group: "signature" },
      { label: "침실", group: "room" },
      { label: "야외 스케이트장", group: "signature" },
    ]);
    expect(out).toEqual(["야외수영장", "바베큐", "히노끼 욕조", "야외 스케이트장"]);
  });
});

describe("animateTargets", () => {
  it("animates only the best water/signature stills once photos are sorted", async () => {
    const { animateTargets } = await import("@/lib/photo-groups");
    const a = (id: string, group?: "water" | "signature" | "room" | "other", videoFile?: string) => ({ id, group, videoFile });
    const sorted = [a("w1", "water", "w1.mp4"), a("w2", "water"), a("w3", "water"), a("w4", "water"), a("s1", "signature"), a("s2", "signature"), a("s3", "signature"), a("r1", "room"), a("o1", "other")];
    expect(animateTargets(sorted).map((x) => x.id)).toEqual(["w2", "w3", "s1", "s2"]);
    expect(animateTargets([a("x"), a("y", undefined, "y.mp4")]).map((x) => x.id)).toEqual(["x"]);
  });
});
