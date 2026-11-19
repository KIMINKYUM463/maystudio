import { describe, expect, it } from "vitest";
import { averageRenderSeconds, clipCount, formatMinutes } from "@/lib/studio-stats";

const render = (status: "done" | "error", startedAt?: string, finishedAt?: string) => ({
  render: { status, progress: 1, carouselFiles: [], startedAt, finishedAt },
});

describe("studio stats", () => {
  it("averages only finished renders with both timestamps", () => {
    const projects = [
      render("done", "2026-11-19T00:00:00Z", "2026-11-19T00:02:00Z"),
      render("done", "2026-11-19T00:00:00Z", "2026-11-19T00:03:00Z"),
      render("error", "2026-11-19T00:00:00Z", "2026-11-19T00:30:00Z"),
      render("done"),
    ];
    expect(averageRenderSeconds(projects)).toBe(150);
    expect(averageRenderSeconds([render("done")])).toBeNull();
  });
  it("formats seconds as Korean minutes", () => {
    expect(formatMinutes(160)).toBe("2분 40초");
    expect(formatMinutes(120)).toBe("2분");
    expect(formatMinutes(45)).toBe("45초");
  });
  it("counts photos that have a motion clip", () => {
    const assets = (n: number, clips: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${i}`, file: "a.jpg", label: "", videoFile: i < clips ? "c.mp4" : undefined }));
    expect(clipCount([{ assets: assets(5, 2) }, { assets: assets(3, 1) }])).toBe(3);
  });
});
