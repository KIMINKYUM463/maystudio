"use client";

import { useState } from "react";
import { Button, Card, SectionTitle, buttonClass, cx } from "@/components/ui";
import { coupangSearchUrl, IDEA_THEMES, STAY_IDEAS, type IdeaTheme } from "@/lib/stay-ideas";

const THEMES = Object.keys(IDEA_THEMES) as IdeaTheme[];

/** Kit's winter stay list: start a project prefilled with one, then paste its Coupang link. */
export function IdeaPicker({ onCreate, creatingId }: { onCreate: (ideaId: string) => void; creatingId: string | null }) {
  const [theme, setTheme] = useState<IdeaTheme>(THEMES[0]);
  const ideas = STAY_IDEAS.filter((idea) => idea.theme === theme);

  return (
    <Card>
      <SectionTitle
        title="올겨울 바로 올리는 숙소 20곳"
        description="다른 채널에서 이미 반응이 검증된 숙소예요. 고르면 정보가 채워진 프로젝트가 만들어지고, 쿠팡 트래블 링크만 붙여넣으면 사진·가격까지 들어와요."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={theme === t}
            onClick={() => setTheme(t)}
            className={cx(
              "rounded-full border px-3 py-1 text-sm transition",
              theme === t ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:border-faint",
            )}
          >
            {IDEA_THEMES[t].label}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ideas.map((idea) => (
          <li key={idea.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{idea.name}</p>
                <p className="text-xs text-muted">
                  {idea.region} · {idea.pitch}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-bold text-accent">
                최고 {idea.topViews}만
              </span>
            </div>
            <div className="mt-auto flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => onCreate(idea.id)}
                loading={creatingId === idea.id}
                disabled={creatingId !== null}
              >
                이걸로 만들기
              </Button>
              <a
                href={coupangSearchUrl(idea.name)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ size: "sm", variant: "ghost" })}
              >
                쿠팡에서 찾기 ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-faint">
        최고 조회수는 다른 채널의 이 숙소 릴스 중 가장 높았던 숫자예요 (2026년 10월 기준). 겨울 운영 여부·가격은 꼭 쿠팡에서
        확인하세요.
      </p>
    </Card>
  );
}
