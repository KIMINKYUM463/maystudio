import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, detectPlatform, parseProductHtml, shortAddress } from "@/lib/import-parser";
import { extractJson, parseLlmOutput } from "@/lib/server/llm";

const HOTEL_HTML = `<!doctype html><html><head>
<title>오션뷰 스테이 | 마이리얼트립</title>
<meta property="og:image" content="/img/og.jpg" />
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"BreadcrumbList"},
  {"@type":"Hotel","name":"오션뷰 스테이","image":["https://cdn.test/1.jpg",{"url":"https://cdn.test/2.jpg"}],
   "address":{"addressRegion":"강원","addressLocality":"강릉"},
   "aggregateRating":{"ratingValue":"4.83"},
   "offers":{"lowPrice":"89000","priceCurrency":"KRW"}}
]}</script>
<script type="application/ld+json">{ broken json</script>
</head><body></body></html>`;

describe("import parser", () => {
  it("reads hotel JSON-LD inside @graph and absolutizes OG images", () => {
    const { product, images } = parseProductHtml(HOTEL_HTML, "https://www.myrealtrip.com/offers/1");
    expect(product).toMatchObject({
      name: "오션뷰 스테이",
      region: "강원 강릉",
      priceText: "89,000원~",
      rating: "4.8",
      platform: "myrealtrip",
    });
    expect(images.map((i) => i.url)).toEqual([
      "https://cdn.test/1.jpg",
      "https://cdn.test/2.jpg",
      "https://www.myrealtrip.com/img/og.jpg",
    ]);
  });

  it("falls back to OG tags and strips the site suffix from the title", () => {
    const html = `<meta property="og:title" content="제주 독채 펜션 | 여기어때"><meta property="og:image" content="https://cdn.test/a.jpg">`;
    const { product, images } = parseProductHtml(html, "https://www.yeogi.com/x");
    expect(product.name).toBe("제주 독채 펜션");
    expect(product.priceText).toBe("");
    expect(product.platform).toBe("yeogi");
    expect(images).toEqual([{ url: "https://cdn.test/a.jpg", label: "" }]);
  });

  it("reads Coupang Travel's embedded product data", () => {
    const thumb = (n: number) => `//image.test/image/resized_image/thumbnails/remote/492x492ex/image/rs_quotation_api/${n}.jpg`;
    const data = {
      product: {
        productName: "소노벨 변산 (구 대명리조트 변산)",
        productDetailType: "RESORT",
        location: { address: "전라북도 부안군 변산면 변산해변로 51" },
        productReview: { ratingAverage: 4.46, ratingCount: 1200 },
        facilities: [
          {
            title: "인기 편의시설",
            facilities: [{ description: "주차장" }, { description: "실내 수영장" }, { description: "온천/스파/사우나" }],
          },
        ],
        introductions: [{ themes: ["가족여행", "오션뷰"], description: "서해 바다 앞 리조트" }],
        imageGroups: [
          { type: "all", images: [{ originImagePath: thumb(1) }, { originImagePath: thumb(2) }, { originImagePath: thumb(1) }] },
          { type: "view", name: "전경", images: [{ originImagePath: thumb(1) }] },
          { type: "room", name: "객실", images: [{ originImagePath: thumb(2) }] },
        ],
        representativeVendorItem: { price: null },
        bestReview: { reviewContent: { title: "아이들이 좋아해요", content: "수영장이 따뜻해요" } },
      },
    };
    const html = `<script id="travel-detail-product-data" type="application/json">${JSON.stringify(data)}</script>`;
    const { product, images } = parseProductHtml(html, "https://trip.coupang.com/tp/products/1");
    expect(product).toMatchObject({
      name: "소노벨 변산",
      stayType: "리조트",
      region: "전북 부안",
      rating: "4.5",
      priceText: "",
      features: ["실내 수영장", "온천/스파/사우나"],
      target: "아이",
      platform: "coupang",
    });
    expect(product.notes).toContain("수영장이 따뜻해요");
    expect(images).toEqual([
      { url: "https://image.test/image/rs_quotation_api/1.jpg", label: "전경" },
      { url: "https://image.test/image/rs_quotation_api/2.jpg", label: "객실" },
    ]);
  });

  it("shortens Korean addresses to province + city", () => {
    expect(shortAddress("서울특별시 성북구 성북로 1")).toBe("서울 성북");
    expect(shortAddress("경상북도 청송군 주왕산면")).toBe("경북 청송");
    expect(shortAddress("제주특별자치도 서귀포시 중문")).toBe("제주 서귀포");
  });

  it("detects affiliate platforms by host", () => {
    expect(detectPlatform("https://trip.coupang.com/tp/products/1")).toBe("coupang");
    expect(detectPlatform("https://notcoupang.com/x")).toBe("other");
    expect(detectPlatform("https://www.agoda.com/ko-kr/x")).toBe("agoda");
    expect(detectPlatform("https://kr.trip.com/hotels/x")).toBe("tripcom");
    expect(detectPlatform("not a url")).toBe("other");
  });

  it("refuses private and non-http URLs", () => {
    for (const bad of [
      "http://localhost:3000",
      "http://127.0.0.1",
      "http://192.168.0.2",
      "http://10.1.1.1",
      "http://[::1]/",
      "file:///c:/x",
      "javascript:alert(1)",
    ]) {
      expect(() => assertPublicHttpUrl(bad), bad).toThrow();
    }
    expect(assertPublicHttpUrl("https://www.myrealtrip.com/a").hostname).toBe("www.myrealtrip.com");
  });
});

describe("llm output", () => {
  it("extracts JSON wrapped in prose or code fences", () => {
    expect(extractJson('결과입니다:\n```json\n{"scenes":[{"id":"hook"}]}\n```')).toEqual({ scenes: [{ id: "hook" }] });
    expect(() => extractJson("no json")).toThrow();
  });

  it("converts escaped newlines, normalizes hashtags and rejects a CTA without the keyword", () => {
    const result = parseLlmOutput(
      {
        scenes: [
          { id: "hook", caption: "강릉 1박 8만원대?\\n이 뷰 실화", narration: "와" },
          { id: "cta", caption: "링크는 프로필에", narration: "프로필 확인" },
        ],
        hashtags: ["#강릉 숙소", "강릉숙소", "감성숙소", "a", "b", "c", "d"],
      },
      "숙소",
    );
    expect(result.overrides.hook.caption).toBe("강릉 1박 8만원대?\n이 뷰 실화");
    expect(result.overrides.cta.caption).toBeUndefined();
    expect(result.overrides.cta.narration).toBe("프로필 확인");
    expect(result.hashtags).toEqual(["강릉숙소", "감성숙소", "a", "b", "c"]);
  });
});
