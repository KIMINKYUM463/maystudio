import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmp = path.resolve(mkdtempSync(path.join(os.tmpdir(), "maystudio-test-")));
let store: typeof import("@/lib/server/store");

beforeAll(async () => {
  process.env.MAYSTUDIO_DATA_DIR = tmp;
  store = await import("@/lib/server/store");
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("store", () => {
  it("creates, updates, lists and deletes projects", async () => {
    const created = await store.createProject({ instagramHandle: "@me", defaultCommentKeyword: "강릉" });
    expect(store.isValidId(created.id)).toBe(true);
    expect(created.style.watermark).toBe("@me");
    expect(created.copy.commentKeyword).toBe("강릉");

    const updated = await store.updateProject(created.id, (p) => ({ ...p, title: "바뀐 제목" }));
    expect(updated.title).toBe("바뀐 제목");
    expect((await store.getProject(created.id)).title).toBe("바뀐 제목");
    expect((await store.listProjects()).map((p) => p.id)).toContain(created.id);

    await store.deleteProject(created.id);
    await expect(store.getProject(created.id)).rejects.toBeInstanceOf(store.NotFoundError);
  });

  it("rejects path traversal and malformed ids", () => {
    expect(() => store.resolveDataPath("../outside.txt")).toThrow();
    expect(() => store.resolveDataPath("projects/../../x")).toThrow();
    expect(() => store.projectFilePath("abcdef", "../../../x")).toThrow();
    expect(() => store.projectDir("../evil")).toThrow(store.NotFoundError);
    expect(store.resolveDataPath("projects/abc/assets/a.jpg")).toBe(path.join(tmp, "projects", "abc", "assets", "a.jpg"));
  });

  it("counts clicks per day", async () => {
    await store.recordClick("AbCdEf12", new Date("2026-11-03T01:00:00Z"));
    await store.recordClick("AbCdEf12", new Date("2026-11-03T05:00:00Z"));
    await store.recordClick("AbCdEf12", new Date("2026-11-04T01:00:00Z"));
    expect((await store.getClicks()).AbCdEf12).toEqual({ total: 3, byDay: { "2026-11-03": 2, "2026-11-04": 1 } });
  });

  it("returns default settings when none are saved", async () => {
    const settings = await store.getSettings();
    expect(settings.llmProvider).toBe("none");
    expect(settings.defaultCommentKeyword).toBe("숙소");
  });
});
