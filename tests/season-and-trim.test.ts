import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/lib/project-factory";
import { buildSeasonPrompt, resolveSeason } from "@/lib/script/season-prompts";
import { parseSilences, speechWindow } from "@/lib/server/audio-trim";

describe("resolveSeason", () => {
  it("follows the Korean month for auto", () => {
    expect(resolveSeason("auto", new Date(2026, 10, 21))).toBe("autumn");
    expect(resolveSeason("auto", new Date(2026, 0, 5))).toBe("winter");
    expect(resolveSeason("auto", new Date(2026, 3, 1))).toBe("spring");
    expect(resolveSeason("auto", new Date(2026, 6, 1))).toBe("summer");
  });
  it("keeps a picked season", () => {
    expect(resolveSeason("winter", new Date(2026, 6, 1))).toBe("winter");
  });
});

describe("buildSeasonPrompt", () => {
  it("asks for 9:16, keeps the place and includes the line as mood only", () => {
    const prompt = buildSeasonPrompt("autumn", "뜨끈한 온돌방에 누워서 가는 기차");
    expect(prompt).toContain("9:16");
    expect(prompt).toContain("autumn: the existing trees");
    expect(prompt).not.toContain("rice");
    expect(prompt).toContain("Keep the place exactly the same");
    expect(prompt).toContain("뜨끈한 온돌방");
  });
});

describe("TTS silence trimming", () => {
  // Real Typecast clip: 0.44s silence before speech, 0.13s after.
  const log = "[silencedetect] silence_start: 0\n[silencedetect] silence_end: 0.443197 | silence_duration: 0.44\n[silencedetect] silence_start: 2.646825\n";
  it("parses an open silence at the end as running to the duration", () => {
    expect(parseSilences(log, 2.772721)).toEqual([
      { start: 0, end: 0.443197 },
      { start: 2.646825, end: 2.772721 },
    ]);
  });
  it("keeps the speech with a short margin and leaves inner pauses", () => {
    const silences = [...parseSilences(log, 2.772721), { start: 1.2, end: 1.5 }];
    const window = speechWindow(silences, 2.772721)!;
    expect(window.start).toBeCloseTo(0.393, 3);
    expect(window.end).toBeCloseTo(2.697, 3);
  });
  it("leaves clips without edge silence or with no speech alone", () => {
    expect(speechWindow([], 2)).toBeNull();
    expect(speechWindow([{ start: 0, end: 2 }], 2)).toBeNull();
  });
});

describe("project defaults", () => {
  it("new projects start from the saved look and voice", () => {
    const project = createEmptyProject("x", "2026-11-21T00:00:00.000Z", {
      typecastKey: "k",
      projectDefaults: {
        style: { subtitleStyle: "serif", bgmTrack: "none", sfx: false, accentColor: "#B0F000" },
        voice: { provider: "typecast", voiceId: "tc_69f2e455ea79fd197aa0476f", speed: 1.1 },
      },
    });
    expect(project.style).toMatchObject({ subtitleStyle: "serif", bgmTrack: "none", sfx: false, accentColor: "#B0F000", template: "review" });
    expect(project.voice.voiceId).toBe("tc_69f2e455ea79fd197aa0476f");
  });
  it("cleared defaults (null) fall back to the built-in start", () => {
    const project = createEmptyProject("x", "2026-11-21T00:00:00.000Z", { projectDefaults: null });
    expect(project.style.bgmTrack).toBe("calm");
  });
});
