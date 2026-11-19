"use client";

import { cx } from "@/components/ui";

export const AUTO_STAGES = ["classify", "script", "voice", "render", "done"] as const;
export type AutoStage = (typeof AUTO_STAGES)[number] | "error";

const LABELS: Record<(typeof AUTO_STAGES)[number], string> = {
  classify: "AI 사진 분류",
  script: "AI 대본 작성",
  voice: "AI 목소리 생성",
  render: "릴스 영상 렌더링",
  done: "완성",
};

/**
 * Live view of what one-click creation is doing right now, so viewers watch the AI work
 * (the real pipeline stages, not a mock). Shown bottom-right until closed.
 */
export function AutoCreatePanel({
  stage,
  progress,
  skipped,
  hookLine,
  onClose,
}: {
  stage: AutoStage;
  /** Render progress 0~1 while stage === "render". */
  progress: number;
  /** Stages that did not run (no key, nothing to classify). */
  skipped: ReadonlySet<AutoStage>;
  /** First narration line, shown once the script exists. */
  hookLine: string;
  onClose: () => void;
}) {
  const index = stage === "error" ? -1 : AUTO_STAGES.indexOf(stage);
  const finished = stage === "done" || stage === "error";
  const overall = stage === "done" ? 100 : Math.round(((Math.max(index, 0) + (stage === "render" ? progress : 0)) / 4) * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-5 bottom-5 z-40 w-80 rounded-2xl border border-line bg-surface/95 p-4 shadow-[0_24px_60px_-20px_rgb(15_23_42/0.45)] backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold">
          {finished ? null : (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-accent" />
            </span>
          )}
          {stage === "done" ? "릴스가 완성됐어요" : stage === "error" ? "중간에 멈췄어요" : "AI가 릴스를 만드는 중"}
        </span>
        {finished ? (
          <button type="button" onClick={onClose} aria-label="진행 창 닫기" className="rounded-md px-1.5 text-muted hover:bg-surface-2 hover:text-fg">
            ✕
          </button>
        ) : (
          <span className="tabular text-xs font-bold text-accent">{overall}%</span>
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cx("h-full rounded-full transition-[width] duration-700 ease-out", stage === "error" ? "bg-danger" : "bg-accent")}
          style={{ width: `${overall}%` }}
        />
      </div>
      <ol className="mt-3 flex flex-col gap-1.5">
        {AUTO_STAGES.slice(0, 4).map((s, i) => {
          const done = index > i || stage === "done";
          const active = index === i;
          const skip = skipped.has(s);
          return (
            <li key={s} className="flex items-start gap-2.5 text-[13px]">
              <span
                className={cx(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  done ? "border-accent bg-accent text-white" : active ? "border-accent" : "border-line",
                )}
              >
                {done ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                ) : active ? (
                  <span className="size-2.5 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                ) : null}
              </span>
              <div className="min-w-0">
                <p className={cx("font-semibold", done || active ? "text-fg" : "text-faint")}>
                  {LABELS[s]}
                  {skip && done ? <span className="ml-1.5 text-xs font-normal text-faint">건너뜀</span> : null}
                  {s === "render" && active ? <span className="tabular ml-1.5 text-xs text-accent">{Math.round(progress * 100)}%</span> : null}
                </p>
                {s === "script" && hookLine && (done || active) ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">“{hookLine}”</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
