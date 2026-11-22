"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/components/ui";
import type { Style, TemplateId } from "@/lib/types";
import type { VideoProps } from "@/lib/video/props";

const FramePreview = dynamic(() => import("./FramePreview"), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse bg-surface-3" />,
});

/** Looks seen on real channels, each a template + subtitle look combination. */
const LOOKS: { key: string; label: string; note: string; template: TemplateId; subtitleStyle?: Style["subtitleStyle"] }[] = [
  { key: "review-serif", label: "허지니형", note: "명조 말자막 · 1.1초 컷", template: "review", subtitleStyle: "serif" },
  { key: "review-bold", label: "런비형", note: "굵은 고딕 말자막 · 정중앙", template: "review", subtitleStyle: "bold" },
  { key: "review-may", label: "메이형", note: "콘콘체 말자막 · [광고]", template: "review", subtitleStyle: "may" },
  { key: "emotional", label: "감성 스테이", note: "명조 · 페이드 · 느린 카메라", template: "emotional" },
  { key: "deal", label: "가성비 특가", note: "굵은 고딕 · 외곽선 · 빠른 전환", template: "deal" },
  { key: "luxury", label: "럭셔리 호캉스", note: "얇은 고딕 · 골드 포인트", template: "luxury" },
];

const ACCENTS = ["#2C5FD6", "#FF6B4A", "#FFC83D", "#3DDC97", "#38BDF8", "#A78BFA", "#F472B6", "#D4AF37"];

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-[var(--color-accent)]" />
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="mb-2 text-xs font-bold tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

/**
 * 채널 꾸미기: every look rendered as a real frame of this project's reel, plus the channel's
 * decorations (color, logo, watermark, labels) with a live, playing preview.
 */
export function ChannelDecorDialog({
  open,
  onClose,
  style,
  setStyle,
  baseProps,
  logoSrc,
  onPickLogo,
}: {
  open: boolean;
  onClose: () => void;
  style: Style;
  setStyle: (patch: Partial<Style>) => void;
  baseProps: VideoProps;
  logoSrc: string | null;
  onPickLogo: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const hasScenes = baseProps.scenes.length > 0;
  const current = LOOKS.find((l) => l.template === style.template && (!l.subtitleStyle || l.subtitleStyle === style.subtitleStyle)) ?? LOOKS[0];

  return (
    <dialog
      ref={ref}
      aria-labelledby="decor-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      className="m-auto w-[min(100%-2rem,1180px)] max-w-none overflow-hidden rounded-3xl border border-line bg-bg p-0 text-fg shadow-[0_40px_90px_-30px_rgb(15_23_42/0.5)] backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-5">
          <div>
            <h2 id="decor-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
              채널 꾸미기
            </h2>
            <p className="mt-1 text-sm text-muted">
              {hasScenes ? "이 숙소 영상의 실제 화면으로 보여드려요. 고르면 바로 오른쪽 미리보기에 반영돼요." : "대본을 만들면 실제 영상 화면으로 비교할 수 있어요."}
            </p>
          </div>
          <button type="button" aria-label="닫기" onClick={() => ref.current?.close()} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
            ✕
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6">
            <p className="text-sm font-bold">영상 스타일</p>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
              {LOOKS.map((look) => {
                const selected = look.key === current.key;
                return (
                  <button
                    key={look.key}
                    type="button"
                    onClick={() => setStyle({ template: look.template, ...(look.subtitleStyle ? { subtitleStyle: look.subtitleStyle } : {}) })}
                    className={cx(
                      "overflow-hidden rounded-2xl border bg-surface text-left transition",
                      selected ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-faint",
                    )}
                  >
                    <div className="pointer-events-none overflow-hidden bg-black">
                      {hasScenes ? (
                        <FramePreview props={{ ...baseProps, style: { ...baseProps.style, template: look.template, subtitleStyle: look.subtitleStyle ?? baseProps.style.subtitleStyle } }} frame={40} />
                      ) : (
                        <div className="aspect-[9/16] bg-surface-3" />
                      )}
                    </div>
                    <div className="min-h-[68px] p-3">
                      <p className="flex items-center gap-1.5 text-sm font-bold">
                        {look.label}
                        {selected ? <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] text-white">사용 중</span> : null}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">{look.note}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Group title="포인트 색상">
                <div className="flex flex-wrap items-center gap-2 px-1">
                  {ACCENTS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      onClick={() => setStyle({ accentColor: color })}
                      className={cx("size-8 rounded-full border-2 transition", style.accentColor.toUpperCase() === color ? "scale-110 border-fg" : "border-white shadow")}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="직접 선택"
                    value={style.accentColor}
                    onChange={(e) => setStyle({ accentColor: e.target.value.toUpperCase() })}
                    className="size-8 cursor-pointer rounded-lg border border-line bg-transparent"
                  />
                </div>
              </Group>
              <Group title="채널 로고 · 워터마크">
                <div className="flex items-center gap-3 px-1">
                  <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element -- project media served by our own API
                      <img src={logoSrc} alt="채널 로고" className="max-h-full max-w-full" />
                    ) : (
                      <span className="text-[10px] text-faint">로고 없음</span>
                    )}
                  </span>
                  <button type="button" onClick={onPickLogo} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-accent">
                    {logoSrc ? "로고 바꾸기" : "로고 올리기"}
                  </button>
                  <input
                    aria-label="워터마크"
                    maxLength={30}
                    placeholder="@my_travel"
                    value={style.watermark}
                    onChange={(e) => setStyle({ watermark: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
                  />
                </div>
              </Group>
              <Group title="화면 표시">
                <Switch checked={style.showAdLabel} onChange={(showAdLabel) => setStyle({ showAdLabel })} label="'(광고)' 표시" hint="영상 안에도 광고임을 알리는 게 안전해요." />
                <Switch checked={style.showPriceBadge} onChange={(showPriceBadge) => setStyle({ showPriceBadge })} label="가격 배지" />
                <Switch checked={style.showName} onChange={(showName) => setStyle({ showName })} label="숙소 이름 공개" hint="꺼두면 '여기 어디예요?' 댓글이 늘어요." />
              </Group>
            </div>
          </div>

          <aside className="border-t border-line bg-surface p-6 lg:border-t-0 lg:border-l">
            <p className="text-sm font-bold">미리보기</p>
            <p className="mt-0.5 text-xs text-muted">{current.label} · {current.note}</p>
            <div className="mx-auto mt-3 w-full max-w-[280px] rounded-[2.4rem] bg-[#111827] p-[9px] shadow-[0_24px_44px_-22px_rgba(30,58,138,0.45)]">
              <div className="overflow-hidden rounded-[1.9rem] bg-black">
                {hasScenes ? <FramePreview props={baseProps} playing /> : <div className="aspect-[9/16]" />}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </dialog>
  );
}
