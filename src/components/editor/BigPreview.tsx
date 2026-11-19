"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { VideoProps } from "@/lib/video/props";

const PreviewPlayer = dynamic(() => import("./PreviewPlayer"), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse bg-white/10" />,
});

/**
 * 전체보기: the same reel as large as the screen allows, as a fixed overlay portalled into the open
 * editor <dialog> (or the page) rather than a second dialog.
 */
export function BigPreview({ props, onClose }: { props: VideoProps; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // Capture so Escape closes this view first, not the whole editor dialog.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Portal to the open editor <dialog> (top layer) or body, so no sticky/positioned parent can paint over it.
  const host = typeof document === "undefined" ? null : (document.querySelector("dialog[open]") ?? document.body);
  if (!host) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="영상 전체보기"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative" style={{ width: "min(92vw, calc((100dvh - 4rem) * 9 / 16))" }} onClick={(e) => e.stopPropagation()}>
        <div className="overflow-hidden rounded-[1.75rem] bg-black shadow-2xl ring-1 ring-white/10">
          <PreviewPlayer props={props} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="전체보기 닫기"
          className="absolute -top-3 -right-3 flex size-10 items-center justify-center rounded-full bg-white text-lg font-bold text-fg shadow-lg hover:bg-surface-2 sm:-right-14 sm:top-0"
        >
          ✕
        </button>
      </div>
    </div>,
    host,
  );
}

export function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}
