import { describe, expect, it } from "vitest";
import { DEFAULT_REPLICATE_MODEL } from "@/lib/replicate-models";
import { imageDataUri, i2vInput, modelIdFor, outputFileUrl } from "@/lib/server/replicate";

describe("replicate i2v", () => {
  it("maps each official model to its own image field", () => {
    expect(i2vInput("wan-video/wan-2.2-i2v-fast", "data:image/jpeg;base64,xx", "steam")).toEqual({
      image: "data:image/jpeg;base64,xx",
      prompt: "steam",
    });
    expect(i2vInput("bytedance/seedance-1-lite", "img", "steam")).toEqual({
      image: "img",
      prompt: "steam",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "9:16",
    });
    expect(i2vInput("kwaivgi/kling-v2.5-turbo-pro", "img", "steam")).toEqual({
      start_image: "img",
      prompt: "steam",
      duration: 5,
    });
  });

  it("picks the first https url from nested Replicate output", () => {
    expect(outputFileUrl("https://replicate.delivery/a.mp4")).toBe("https://replicate.delivery/a.mp4");
    expect(outputFileUrl(["https://replicate.delivery/a.mp4"])).toBe("https://replicate.delivery/a.mp4");
    expect(outputFileUrl({ href: "https://replicate.delivery/a.mp4" })).toBe("https://replicate.delivery/a.mp4");
    expect(outputFileUrl([{ href: "https://replicate.delivery/a.mp4" }])).toBe("https://replicate.delivery/a.mp4");
    expect(outputFileUrl("not-a-url")).toBeNull();
  });

  it("falls back to the default model when the setting is blank or unknown", () => {
    expect(modelIdFor({ replicateModel: "" })).toBe(DEFAULT_REPLICATE_MODEL);
    expect(modelIdFor({ replicateModel: "someone/unknown" })).toBe(DEFAULT_REPLICATE_MODEL);
    expect(modelIdFor({ replicateModel: "kwaivgi/kling-v2.5-turbo-pro" })).toBe("kwaivgi/kling-v2.5-turbo-pro");
  });

  it("encodes jpg stills and rejects formats Replicate will not take", () => {
    expect(imageDataUri(Buffer.from("hi"), "room.jpg")).toBe("data:image/jpeg;base64,aGk=");
    expect(() => imageDataUri(Buffer.from("hi"), "room.gif")).toThrow(/JPG·PNG·WEBP/);
  });
});
