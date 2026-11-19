"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { HOOK_STYLE_GUIDES } from "@/lib/script/hook-styles";
import { HOOK_ANGLE_LABELS } from "@/lib/script/hooks";
import { HOOK_ANGLES, type HookAngle } from "@/lib/types";

/**
 * All hook styles in one popup: list on the left, the chosen style's sample script and
 * line-by-line structure analysis on the right. Picking a style closes the popup.
 */
export function HookStyleDialog({
  open,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  current: HookAngle;
  onClose: () => void;
  onPick: (angle: HookAngle) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [viewing, setViewing] = useState<HookAngle>(current);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const guide = HOOK_STYLE_GUIDES[viewing];
  const label = HOOK_ANGLE_LABELS[viewing];

  return (
    <dialog
      ref={ref}
      aria-labelledby="hook-styles-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      className="m-auto w-[min(100%-2rem,1040px)] max-w-none overflow-hidden rounded-3xl border border-line bg-bg p-0 text-fg shadow-[0_40px_90px_-30px_rgb(15_23_42/0.5)] backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-5">
          <div>
            <h2 id="hook-styles-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
              훅 스타일 {HOOK_ANGLES.length}가지
            </h2>
            <p className="mt-1 text-sm text-muted">인스타·유튜브·틱톡에서 반응이 터진 쇼핑숏폼 대본 구조를 템플릿으로 만들었어요.</p>
          </div>
          <button
            type="button"
            aria-label="훅 스타일 닫기"
            onClick={() => ref.current?.close()}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <ul className="overflow-y-auto border-b border-line p-3 md:border-r md:border-b-0">
            {HOOK_ANGLES.map((angle) => {
              const info = HOOK_ANGLE_LABELS[angle];
              return (
                <li key={angle}>
                  <button
                    type="button"
                    onClick={() => setViewing(angle)}
                    aria-current={viewing === angle ? "true" : undefined}
                    className={cx(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      viewing === angle ? "bg-accent/10" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        {info.label}
                        {current === angle ? (
                          <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">사용 중</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">{info.description}</span>
                    </span>
                    <span className={cx("mt-0.5 text-xs font-semibold", viewing === angle ? "text-accent" : "text-faint")}>예시 ›</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <section className="overflow-y-auto p-6" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-accent">{guide.source}</p>
                <h3 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.02em]">{label.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  onPick(viewing);
                  ref.current?.close();
                }}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgb(44_95_214/0.7)] transition hover:bg-accent-strong"
              >
                {current === viewing ? "사용 중인 스타일" : "이 스타일로 대본 쓰기"}
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold text-muted">공식</p>
              <p className="mt-1 text-base font-bold">{guide.formula}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-success">이런 숙소에 잘 맞아요</p>
                  <p className="mt-0.5 text-sm text-fg">{guide.bestFor}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-warning">주의할 점</p>
                  <p className="mt-0.5 text-sm text-fg">{guide.caution}</p>
                </div>
              </div>
            </div>

            <h4 className="mt-6 text-sm font-bold">예시 대본과 구조 분석</h4>
            <ol className="relative mt-3 flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[47px] before:w-px before:bg-line">
              {guide.beats.map((beat) => (
                <li key={beat.time + beat.role} className="relative grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <span className="tabular rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-bold text-muted">{beat.time}</span>
                    <span className="relative z-10 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{beat.role}</span>
                  </div>
                  <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-[0_1px_2px_0_rgb(16_24_40/0.04)]">
                    <p className="font-display text-[15px] leading-relaxed font-extrabold">&ldquo;{beat.line}&rdquo;</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">{beat.why}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </dialog>
  );
}
