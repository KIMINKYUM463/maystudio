import { describe, expect, it } from "vitest";
import { clickRate, formatRate, funnelAdvice } from "@/lib/funnel";
import { josa } from "@/lib/script/josa";
import { audienceOf, romanceFor, romanceSuggestions } from "@/lib/script/romance";
import { buildVideoPrompt, detectPromptType, labelHasPeople } from "@/lib/script/video-prompts";
import { parseLlmOutput } from "@/lib/server/llm";
import { IDEA_THEMES, productFromIdea, STAY_IDEAS } from "@/lib/stay-ideas";
import { productSchema, projectSchema } from "@/lib/types";
import { sampleProject } from "./fixtures";

describe("josa", () => {
  it("picks the particle by the final consonant", () => {
    expect(josa("아이", "이랑")).toBe("아이랑");
    expect(josa("부모님", "이랑")).toBe("부모님이랑");
    expect(josa("겨울 온천", "은")).toBe("겨울 온천은");
    expect(josa("연말 호캉스", "은")).toBe("연말 호캉스는");
    expect(josa("소노벨 청송", "이에요")).toBe("소노벨 청송이에요");
    expect(josa("오션뷰 스테이", "이에요")).toBe("오션뷰 스테이예요");
  });
  it("drops 으 after ㄹ for 으로 and reads digits aloud", () => {
    expect(josa("서울", "으로")).toBe("서울로");
    expect(josa("1박 8만원", "으로")).toBe("1박 8만원으로");
    expect(josa("2017", "이")).toBe("2017이");
    expect(josa("2", "이")).toBe("2가");
  });
});

describe("romance (FAB)", () => {
  it("maps targets to audiences", () => {
    expect(audienceOf("아이, 가족")).toBe("family");
    expect(audienceOf("엄마 칠순")).toBe("parents");
    expect(audienceOf("커플")).toBe("couple");
    expect(audienceOf("")).toBe("any");
  });
  it("turns a feature into a line for the audience", () => {
    const line = romanceFor({ features: ["객실 전용 노천탕"], target: "커플" });
    expect(line.feature).toBe("객실 전용 노천탕");
    expect(line.caption).toContain("둘이");
  });
  it("claims privacy only when the listing says the bath is private", () => {
    expect(romanceFor({ features: ["객실 전용 노천탕"], target: "" }).benefit).toContain("눈치 없이");
    const shared = romanceFor({ features: ["숲속 노천 온천"], target: "커플" });
    expect(`${shared.benefit} ${shared.caption} ${shared.narration}`).not.toMatch(/눈치|우리끼리|만 쓰는/);
  });
  it("never writes as if the creator stayed there", () => {
    const features = ["노천탕", "온수풀", "한옥 온돌", "오션뷰", "숲", "불멍", "바비큐", "찜질", "료칸", "야경", "조식", "기차"];
    for (const target of ["아이", "부모님", "커플", "친구", "혼자", ""]) {
      for (const r of romanceSuggestions({ features, target })) {
        expect(`${r.caption} ${r.narration}`).not.toMatch(/제가|저희|다녀왔|가봤/);
      }
    }
  });
  it("falls back to a generic line when no feature has one", () => {
    expect(romanceFor({ features: ["무료 주차"], target: "" }).caption).toContain("쉬기만 해도");
  });
});

describe("legacy projects", () => {
  it("migrates old hook angles and fills new fields with defaults", () => {
    const raw = JSON.parse(JSON.stringify(sampleProject())) as Record<string, unknown>;
    raw.hookAngle = "scarcity";
    delete raw.stats;
    const parsed = projectSchema.parse(raw);
    expect(parsed.hookAngle).toBe("tip");
    expect(parsed.stats).toEqual({ views: 0 });
    expect(parsed.style.showName).toBe(false);
    expect(productSchema.parse({}).stayType).toBe("");
  });
});

describe("AI video prompts", () => {
  it("detects the photo type from its label", () => {
    expect(detectPromptType("노천탕")).toBe("hotspring");
    expect(detectPromptType("객실")).toBe("interior");
    expect(detectPromptType("전경")).toBe("view");
    expect(detectPromptType("조식")).toBe("food");
    expect(detectPromptType("")).toBe("nature");
    expect(labelHasPeople("가족 사진")).toBe(true);
  });
  it("always pins the scene and switches the people clause", () => {
    const empty = buildVideoPrompt("hotspring", false);
    expect(empty).toContain("soft steam rises");
    expect(empty).toContain("No people appear.");
    expect(empty).toContain("9:16 vertical");
    const people = buildVideoPrompt("interior", true);
    expect(people).toContain("Same people throughout the clip");
    expect(people).not.toContain("No people appear.");
  });
});

describe("funnel", () => {
  it("computes click rate only once views are known", () => {
    expect(clickRate(0, 5)).toBeNull();
    expect(formatRate(clickRate(2000, 30))).toBe("1.5%");
    expect(formatRate(null)).toBe("-");
  });
  it("points at the leaking stage", () => {
    expect(funnelAdvice(0, 0)).toBeNull();
    expect(funnelAdvice(300, 2)?.text).toContain("훅");
    expect(funnelAdvice(20000, 10)?.text).toContain("키워드");
    expect(funnelAdvice(20000, 400)?.tone).toBe("success");
  });
});

describe("stay ideas", () => {
  it("lists the kit's 20 stays with unique ids and valid product fields", () => {
    expect(STAY_IDEAS).toHaveLength(20);
    expect(new Set(STAY_IDEAS.map((i) => i.id)).size).toBe(20);
    for (const idea of STAY_IDEAS) {
      expect(() => productSchema.parse(productFromIdea(idea)), idea.id).not.toThrow();
      expect(IDEA_THEMES[idea.theme]).toBeDefined();
    }
  });
});

describe("llm name guard", () => {
  it("drops AI text that leaks the hidden stay name", () => {
    const result = parseLlmOutput(
      { scenes: [{ id: "hook", caption: "소노벨 청송 실화?", narration: "숲속 노천 온천이에요" }] },
      "쉼",
      "소노벨 청송",
    );
    expect(result.overrides.hook.caption).toBeUndefined();
    expect(result.overrides.hook.narration).toBe("숲속 노천 온천이에요");
  });
});
