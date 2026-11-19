import { describe, expect, it } from "vitest";
import { quoteFromNotes, quoteFromReview } from "@/lib/review-quote";

describe("review quote", () => {
  it("takes the first meaningful sentence, verbatim, and trims long ones at a word", () => {
    expect(quoteFromReview("최고", "아이들이 온수풀에서 안 나오려고 했어요. 조식도 맛있었고 직원분들도 친절했습니다.")).toBe(
      "아이들이 온수풀에서 안 나오려고 했어요.",
    );
    const long = quoteFromReview("", "가 ".repeat(50));
    expect(long.length).toBeLessThanOrEqual(61);
    expect(long.endsWith("…")).toBe(true);
    expect(quoteFromReview("", "")).toBe("");
  });

  it("reads the best review line the Coupang import writes into notes", () => {
    const notes = "베스트 리뷰: 재방문 의사 100% - 노천탕에서 별 보면서 쉬니까 피로가 다 풀렸어요. 강추\n숙소 테마: 온천";
    expect(quoteFromNotes(notes)).toBe("노천탕에서 별 보면서 쉬니까 피로가 다 풀렸어요.");
    expect(quoteFromNotes("메모만 있어요")).toBe("");
  });
});
