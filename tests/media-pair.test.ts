import { describe, expect, it } from "vitest";
import { mediaStem, planMediaUpload } from "@/lib/media-pair";

const file = (name: string, type: string) => ({ name, type });
const photo = (id: string, fileName: string, label = "", videoFile?: string) => ({
  id,
  file: `assets/${fileName}`,
  label,
  videoFile,
});

describe("mediaStem", () => {
  it("pairs a Flow still with its clip even when suffixes differ", () => {
    expect(mediaStem("온천뷰.jpg")).toBe(mediaStem("온천뷰_video.mp4"));
    expect(mediaStem("IMG_001.png")).toBe(mediaStem("IMG_001.mp4"));
    expect(mediaStem("folder/온천뷰 flow.mp4")).toBe(mediaStem("온천뷰.webp"));
  });
});

describe("planMediaUpload", () => {
  it("makes one card from a same-name still + Flow clip (does not add a second still)", () => {
    const plan = planMediaUpload(
      [file("온천뷰.jpg", "image/jpeg"), file("온천뷰.mp4", "video/mp4"), file("객실.jpg", "image/jpeg")],
      [],
    );
    expect(plan.pairs).toEqual([{ image: file("온천뷰.jpg", "image/jpeg"), video: file("온천뷰.mp4", "video/mp4") }]);
    expect(plan.images.map((f) => f.name)).toEqual(["객실.jpg"]);
    expect(plan.videos).toEqual([]);
    expect(plan.attach).toEqual([]);
  });

  it("attaches a later Flow drop onto existing photos in the same order", () => {
    const plan = planMediaUpload(
      [file("download.mp4", "video/mp4"), file("download (1).mp4", "video/mp4")],
      [photo("a", "a.jpg", "외관"), photo("b", "b.jpg", "객실"), photo("c", "c.jpg", "야경", "assets/c-clip.mp4")],
    );
    expect(plan.attach.map((x) => x.assetId)).toEqual(["a", "b"]);
    expect(plan.pairs).toEqual([]);
    expect(plan.videos).toEqual([]);
  });

  it("attaches by label when the clip was named after the photo", () => {
    const plan = planMediaUpload([file("객실.mp4", "video/mp4")], [photo("b", "xyz.jpg", "객실")]);
    expect(plan.attach).toEqual([{ assetId: "b", video: file("객실.mp4", "video/mp4") }]);
  });

  it("pairs a same-count still+clip folder even when Flow renamed the clips", () => {
    const plan = planMediaUpload(
      [file("1.jpg", "image/jpeg"), file("2.jpg", "image/jpeg"), file("download.mp4", "video/mp4"), file("download (1).mp4", "video/mp4")],
      [],
    );
    expect(plan.pairs).toHaveLength(2);
    expect(plan.images).toEqual([]);
    expect(plan.videos).toEqual([]);
  });
});
