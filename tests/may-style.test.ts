import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/lib/project-factory";
import { buildMayUserPrompt, cleanScript, distributeScript, mayBeats, MAY_HOOK_STYLES, scriptChars, seasonLine } from "@/lib/script/may-prompt";
import { HOOK_ANGLES } from "@/lib/types";
import { lineWidthEm, mayCoverSize } from "@/remotion/covers";

describe("메이 대본 프롬프트", () => {
  it("has all 15 hook styles from her file", () => {
    for (const angle of HOOK_ANGLES) expect(MAY_HOOK_STYLES[angle].example.length).toBeGreaterThan(40);
  });

  it("names the season by the day the script is written", () => {
    expect(seasonLine(new Date(2026, 10, 22))).toBe("늦가을(11월)");
    expect(seasonLine(new Date(2026, 0, 3))).toBe("겨울(1월)");
    expect(seasonLine(new Date(2026, 5, 3))).toBe("초여름(6월)");
  });

  it("counts characters without spaces and punctuation", () => {
    expect(scriptChars("아이랑 겨울 온천, 갈 거면 여기예요.")).toBe(14);
  });

  it("sends the style block, every stay field and the visited flag", () => {
    const project = createEmptyProject("x", "2026-11-22T00:00:00.000Z");
    project.hookAngle = "twist";
    project.product = { ...project.product, region: "강원 춘천", stayType: "펜션", features: ["노천탕", "불멍"], visited: false };
    const prompt = buildMayUserPrompt(project, new Date(2026, 10, 22));
    expect(prompt).toContain("[선택한 훅 스타일] 반전형");
    expect(prompt).toContain("오늘 계절: 늦가을(11월)");
    expect(prompt).toContain("지역: 강원 춘천");
    expect(prompt).toContain("특징: 노천탕, 불멍");
    expect(prompt).toContain("직접 다녀온 숙소: 아니오");
    expect(prompt).toContain("대본 1편만 출력해.");
  });

  it("cleans quotes, labels and line breaks from a reply", () => {
    expect(cleanScript("대본: “요즘 지쳤다면 여기 보세요.\n문만 열면 바다예요.”")).toBe("요즘 지쳤다면 여기 보세요. 문만 열면 바다예요.");
  });
});

describe("대본을 장면에 나누기", () => {
  const ids = ["hook", "proof", "points", "extras", "closing"];

  it("puts the hook on the first scene and the last sentence on the closing", () => {
    const script = "아이랑 겨울 온천 갈 거면 여기예요. 객실마다 노천탕이 붙어 있어요. 온수풀까지 무료라 하루 종일 놀 수 있는데, 지치면 바로 방에서 쉬면 돼요. 이번 겨울방학은 여기 하나면 끝이에요.";
    const { lines, drop } = distributeScript(script, ids);
    expect(lines.hook).toBe("아이랑 겨울 온천 갈 거면 여기예요.");
    expect(lines.closing).toBe("이번 겨울방학은 여기 하나면 끝이에요.");
    expect(drop).toEqual([]);
    expect(Object.values(lines).join(" ").replace(/\s/g, "")).toBe(script.replace(/\s/g, ""));
  });

  it("merges sentences when there are more than scenes", () => {
    const { lines, drop } = distributeScript("가. 나나. 다다다. 라라. 마. 바바바.", ["a", "b", "c"]);
    expect(lines.a).toBe("가.");
    expect(lines.c).toBe("바바바.");
    expect(drop).toEqual([]);
    expect(Object.values(lines).join(" ")).toBe("가. 나나. 다다다. 라라. 마. 바바바.");
  });

  it("drops scenes it cannot fill rather than keep template lines", () => {
    const { lines, drop } = distributeScript("여기 가지 마세요. 집에 오기 싫어져요.", ["a", "b", "c", "d"]);
    expect(lines.a).toBe("여기 가지 마세요.");
    expect(lines.d).toBe("집에 오기 싫어져요.");
    expect(drop).toEqual(["b", "c"]);
  });
});

describe("훅 스타일 예시", () => {
  it("shows every style on the fixed timeline", () => {
    for (const angle of HOOK_ANGLES) {
      const beats = mayBeats(angle);
      expect(beats[0].time).toBe("0~2초");
      expect(beats[beats.length - 1].time).toBe("20~25초");
    }
  });
  it("splits a two-sentence example (반전형) into more beats", () => {
    expect(mayBeats("twist").length).toBeGreaterThanOrEqual(3);
  });
});

describe("메이 썸네일 글자 크기", () => {
  it("keeps 150px when both lines fit 864px", () => {
    expect(mayCoverSize("비 오면 더 좋은\n일본 같은 노천탕")).toBe(150);
  });
  it("shrinks 4px at a time to fit, never below 110px", () => {
    const size = mayCoverSize("겨울 아이랑 온천", "paperlogy");
    expect(size).toBeLessThan(150);
    expect((150 - size) % 4).toBe(0);
    expect(lineWidthEm("겨울 아이랑 온천", "paperlogy") * size).toBeLessThanOrEqual(864);
    expect(mayCoverSize("아주아주아주아주아주아주아주아주아주 긴 한 줄", "konkon")).toBe(110);
  });
});
