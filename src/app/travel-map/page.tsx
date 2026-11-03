import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "숙소여행지도 · MayStudio",
  description: "AI 여행 릴스에 등장한 숙소와 오늘 반응이 터진 릴스를 한곳에서 찾아봅니다.",
};

/**
 * AppHeader links to this /travel-map route. No existing route hosts the
 * supplied artifact; its large embedded dataset stays in public/travel-map.html.
 * User request: "이것도 그대로 우리 프로그램에 넣어줘".
 */
export default function TravelMapPage() {
  return (
    <iframe
      title="메이의 숙소여행지도"
      src="/travel-map.html"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      className="block h-[calc(100dvh-3.5rem)] w-full border-0 bg-[#f4f6f7]"
    />
  );
}
