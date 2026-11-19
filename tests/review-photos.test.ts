import { describe, expect, it } from "vitest";
import { parseCoupangTravel } from "@/lib/import-parser";

describe("Coupang review photos", () => {
  it("collects the best review's visible image attachments, not videos or blinded ones", () => {
    const result = parseCoupangTravel(
      {
        product: {
          productName: "테스트 호텔",
          bestReview: {
            reviewContent: { content: "바다뷰가 좋았어요." },
            attachmentInfo: {
              attachments: [
                { attachmentType: "IMAGE", originPath: "https://thumbnail.coupangcdn.com/a.jpg" },
                { attachmentType: "IMAGE", originPath: "https://thumbnail.coupangcdn.com/b.jpg", blinded: true },
                { attachmentType: "VIDEO", originPath: "https://video.coupangcdn.com/v.m3u8" },
              ],
            },
          },
        },
      },
      "https://trip.coupang.com/tp/products/1",
    );
    expect(result.reviewImages).toEqual([{ url: "https://thumbnail.coupangcdn.com/a.jpg", label: "후기 사진" }]);
    expect(result.product.reviewQuote).toBe("바다뷰가 좋았어요.");
  });
});
