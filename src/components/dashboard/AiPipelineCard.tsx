"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

/** The five things one click really does (classify → script → voice → render), shown as a live loop. */
const STEPS = [
  { title: "숙소 링크 분석", detail: "사진 20장 · 편의시설 · 리뷰 수집" },
  { title: "AI 사진 분류", detail: "물놀이 3 · 시그니처 2 · 객실 2" },
  { title: "AI 대본 작성", detail: "문만 열면 바로 노천탕이 있는 말도 안 되는 숙소가 있어요." },
  { title: "AI 목소리", detail: "" },
  { title: "릴스 완성", detail: "21초 · 9:16 · 자막·커버까지" },
] as const;
const SCRIPT_STEP = 2;
const VOICE_STEP = 3;
const STEP_MS = 1700;
const TYPE_MS = 45;

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduce;
}

export function AiPipelineCard({ className }: { className?: string }) {
  const reduce = usePrefersReducedMotion();
  // step === STEPS.length means "all done", held for one beat before the loop restarts.
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setTimeout(
      () => setStep((s) => (s >= STEPS.length ? 0 : s + 1)),
      step === SCRIPT_STEP ? STEP_MS + 900 : step >= STEPS.length ? 2200 : STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [step, reduce]);

  useEffect(() => {
    if (reduce || step !== SCRIPT_STEP) return;
    const id = window.setInterval(() => setTyped((n) => Math.min(n + 1, STEPS[SCRIPT_STEP].detail.length)), TYPE_MS);
    return () => {
      window.clearInterval(id);
      setTyped(0);
    };
  }, [step, reduce]);

  const current = reduce ? STEPS.length : step;
  const percent = Math.round((Math.min(current, STEPS.length) / STEPS.length) * 100);

  return (
    <div
      aria-hidden
      className={cx(
        "w-72 rounded-2xl border border-line bg-surface/90 p-4 shadow-[var(--shadow-card)] backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-fg">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          AI가 만드는 중
        </span>
        <span className="tabular rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold text-accent">{percent}%</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-3 flex flex-col gap-1">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={s.title}
              className={cx(
                "flex gap-2.5 rounded-xl px-2 py-1.5 transition-colors duration-300",
                active && "bg-accent/[0.07]",
              )}
            >
              <span
                className={cx(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  done ? "border-accent bg-accent text-white" : active ? "border-accent text-accent" : "border-line text-faint",
                )}
              >
                {done ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                ) : active ? (
                  <span className="size-2.5 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                ) : null}
              </span>
              <div className="min-w-0">
                <p className={cx("text-[13px] font-semibold", done || active ? "text-fg" : "text-faint")}>{s.title}</p>
                {active && i === VOICE_STEP ? (
                  <span className="mt-1 flex h-3.5 items-end gap-[3px]">
                    {Array.from({ length: 14 }, (_, k) => (
                      <span key={k} className="ai-wave w-[3px] rounded-full bg-accent" style={{ animationDelay: `${(k % 7) * 90}ms` }} />
                    ))}
                  </span>
                ) : active || done ? (
                  <p className="truncate text-[11.5px] text-muted">
                    {active && i === SCRIPT_STEP ? (
                      <>
                        {s.detail.slice(0, typed)}
                        <span className="ml-px inline-block h-3 w-px translate-y-0.5 animate-pulse bg-accent" />
                      </>
                    ) : i === VOICE_STEP ? (
                      "밝은 여성 목소리 · 18초"
                    ) : (
                      s.detail
                    )}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
