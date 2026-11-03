"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Suspense } from "react";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "내 숏폼", segments: [null, "projects"] },
  { href: "/links", label: "링크 페이지", segments: ["links"] },
  { href: "/settings", label: "설정", segments: ["settings"] },
] as const;

/** `segment` undefined = not known yet (prerendered shell), so no item is highlighted. */
function HeaderBar({ segment }: { segment?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-sm text-white">M</span>
          <span>
            MayStudio <span className="font-medium text-muted">여행 숏폼 팩토리</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {NAV.map((item) => {
            const active = segment !== undefined && (item.segments as readonly (string | null)[]).includes(segment);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "rounded-lg px-3 py-1.5 font-medium transition",
                  active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
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
