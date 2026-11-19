"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Suspense } from "react";
import { BrandMark } from "./BrandMark";
import { GearIcon, openSettings } from "./settings/SettingsDialog";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "내 숏폼", segments: [null, "projects"] },
  { href: "/links", label: "링크 페이지", segments: ["links"] },
] as const;

/** `segment` undefined = not known yet (prerendered shell), so no item is highlighted. */
function HeaderBar({ segment }: { segment?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-6 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
          <BrandMark />
          <span className="hidden sm:inline">
            May<span className="text-accent">AI</span>Studio
            <span className="ml-2.5 hidden border-l border-line pl-2.5 font-medium text-muted lg:inline">여행•숙소 쇼핑숏폼 팩토리</span>
          </span>
        </Link>
        <nav className="ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto text-xs sm:gap-1 sm:text-sm">
          {NAV.map((item) => {
            const active = segment !== undefined && (item.segments as readonly (string | null)[]).includes(segment);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "shrink-0 rounded-lg px-2 py-1.5 font-medium transition sm:px-3",
                  active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={openSettings}
          aria-label="설정"
          title="설정"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <GearIcon />
        </button>
      </div>
    </header>
  );
}

function ActiveHeader() {
  const segment = useSelectedLayoutSegment();
  // The public link-in-bio page is shown to followers, so it gets no studio chrome.
  if (segment === "links") return null;
  return <HeaderBar segment={segment} />;
}

/** The current segment is request-time data under Cache Components, so it streams in behind Suspense. */
export function AppHeader() {
  return (
    <Suspense fallback={<HeaderBar />}>
      <ActiveHeader />
    </Suspense>
  );
}
