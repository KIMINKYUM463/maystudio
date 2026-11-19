import { describe, expect, it } from "vitest";
import { computeHot, emptyReelStore, mergeMedia, parseAccounts, pruneReels, reelCode } from "@/lib/reels";
import { dropBanned } from "@/lib/server/llm";
import { stayFromCaption } from "@/lib/server/reel-collector";
import { MAP_STAYS } from "@/lib/stay-map";

const H = 3_600_000;
const T0 = Date.parse("2026-11-19T00:00:00Z");
const media = (id: string, postedAt: number, views: number, comments = 0, extra = {}) => ({
  id,
  permalink: `https://www.instagram.com/reel/${id}code/`,
  timestamp: new Date(postedAt).toISOString(),
  media_product_type: "REELS",
  view_count: views,
  like_count: 10,
  comments_count: comments,
  caption: "캡션",
  ...extra,
});

describe("reel snapshots", () => {
  it("reads reel codes and account names in any form", () => {
    expect(reelCode("https://www.instagram.com/reel/DfMc-B9T5t2/")).toBe("DfMc-B9T5t2");
    expect(reelCode("https://www.instagram.com/someone/reel/ABC_1/")).toBe("ABC_1");
    expect(parseAccounts("@Trip.A\nhttps://www.instagram.com/trip_b/?hl=ko, trip_b  bad!name")).toEqual(["trip.a", "trip_b"]);
  });

  it("keeps only reels with a view count and caps history", () => {
    const store = emptyReelStore();
    const added = mergeMedia(
      store,
      "a",
      [media("r1", T0, 100), { ...media("p1", T0, 5), media_product_type: "FEED" }, { ...media("r2", T0, 0), view_count: undefined }],
      T0 + H,
    );
    expect(added).toBe(1);
    for (let i = 0; i < 80; i++) mergeMedia(store, "a", [media("r1", T0, 100 + i)], T0 + (i + 2) * H);
    expect(store.reels.r1.snaps.length).toBe(60);
    pruneReels(store, T0 + 15 * 24 * H);
    expect(store.reels.r1).toBeUndefined();
  });

  it("marks 떡상 on 100k views or 1,000 comments within 24 hours, and compares to the account's usual", () => {
    const store = emptyReelStore();
    const now = T0 + 30 * H;
    // Old reel posted 30h ago: 50k at 24h ago → 180k now = +130k in 24h → 떡상.
    mergeMedia(store, "a", [media("old", T0, 50_000)], T0 + 6 * H);
    mergeMedia(store, "a", [media("old", T0, 180_000)], now);
    // Young reel (5h old): every view counts as within 24h; 900 comments, 20k views → not 떡상.
    mergeMedia(store, "a", [media("young", now - 5 * H, 20_000, 900)], now);
    // Out of the 72h window.
    mergeMedia(store, "a", [media("stale", now - 100 * H, 1_000_000)], now);
    store.lastRun = now;
    store.runs = 2;
    const feed = computeHot(store, now, (cap) => (cap.includes("캡션") ? "숙소A" : ""));
    // Sorted by views per hour: old 6,000/h, young 4,000/h; the 100h-old reel is out of the window.
    expect(feed.items.map((i) => i.c)).toEqual(["oldcode", "youngcode"]);
    const old = feed.items.find((i) => i.c === "oldcode")!;
    expect(old.d24).toBe(130_000);
    expect(old.boom).toBe(1);
    expect(old.dp).toBe(130_000);
    expect(old.h).toBe("숙소A");
    const young = feed.items.find((i) => i.c === "youngcode")!;
    expect(young.d24).toBe(20_000);
    expect(young.boom).toBe(0);
    expect(young.ph).toBe(4_000);
    // Account median of 180k, 20k, 1M = 180k → old reel is 1.0x, young 0.1x.
    expect(old.x).toBe(1);
    expect(feed.at).toMatch(/^2026-11-20 15:00$/);
    expect(feed.snaps).toBe(2);
  });
});

describe("stay link and script cleanup", () => {
  it("links a caption that names a map stay", () => {
    const stay = MAP_STAYS.find((s) => s.name.replace(/\s/g, "").length >= 5)!;
    expect(stayFromCaption(`여기 ${stay.name} 진짜 좋아요`)).toBe(stay.name);
    expect(stayFromCaption("아무 숙소 이야기")).toBe("");
  });

  it("fixes the 그렇는데 conjugation", () => {
    expect(dropBanned("독채형 펜션이라 그렇는데, 넉넉한 마당까지")).toBe("독채형 펜션이라 그런데, 마당까지");
  });
});
