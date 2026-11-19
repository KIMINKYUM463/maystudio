"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 메이의 숙소여행지도 inside the app. The frame grows to its content's height so the page scrolls,
 * not a box inside it (same-origin file in public/, so its height can be read).
 */
export function MapFrame({ view }: { view: "map" | "hot" }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(900);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let observer: ResizeObserver | null = null;
    const attach = () => {
      const doc = el.contentDocument;
      if (!doc?.body) return;
      // body, not documentElement: the root's scrollHeight never drops below the current frame height.
      const fit = () => setHeight(Math.max(400, Math.ceil(doc.body.getBoundingClientRect().height)));
      observer?.disconnect();
      observer = new ResizeObserver(fit);
      observer.observe(doc.body);
      fit();
    };
    el.addEventListener("load", attach);
    attach();
    return () => {
      el.removeEventListener("load", attach);
      observer?.disconnect();
    };
  }, [view]);

  return (
    <iframe
      key={view}
      ref={frame}
      title={view === "hot" ? "오늘 터진 릴스" : "메이의 숙소여행지도"}
      src={`/travel-map.html?embed=1&view=${view}`}
      scrolling="no"
      style={{ height }}
      className="block w-full overflow-hidden border-0 bg-[#f6f7f9]"
    />
  );
}
