"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { cx } from "@/components/ui";
import { StayRanking } from "@/components/StayRanking";
import { api, errorMessage } from "@/lib/client/api";
import { MAP_STAYS, productFromMapStay, type MapStay } from "@/lib/stay-map";
import type { CatalogEntry } from "@/lib/server/catalog";
import type { Project } from "@/lib/types";
import type { ProjectEditor } from "./useProjectEditor";

const fileUrl = (rel: string) => `/api/files/${rel}`;

const FILL_STEPS = ["숙소 페이지 분석", "사진 가져오기", "상품 정보 입력", "AI가 고른 순서로 사진 정렬"] as const;
/** Each step lingers long enough to be watched in a live demo; the real copy usually finishes sooner. */
const STEP_MS = [1100, 1700, 1500, 900];
const TICK_MS = 2200;

type Tab = "ai" | "ranking" | "map";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** What the radar "reads" for each stay — every number comes from the catalog, nothing invented. */
function radarLines(stays: CatalogEntry[]): string[] {
  return stays.flatMap((s) => [
    `${s.name} · 다른 채널 최고 ${s.topViews}만 회 반응 확인`,
    `${s.region} ${s.stayType} · 공식 사진 ${s.photoCount}장 AI 분류 완료${s.rating ? ` · 평점 ${s.rating}` : ""}`,
  ]);
}

/**
 * 숙소 고르기 step: trending stays as a premium lookbook with a live "AI trend radar" on top.
 * Picking one plays the AI fill sequence while the catalog copy runs server-side, then moves on.
 */
export function StayPicker({ projectId, editor, onDone }: { projectId: string; editor: ProjectEditor; onDone?: () => void }) {
  const [stays, setStays] = useState<CatalogEntry[] | null>(null);
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState(0);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>("ai");

  useEffect(() => {
    api<{ stays: CatalogEntry[] }>("/api/catalog")
      .then(({ stays }) => setStays(stays))
      .catch(() => setStays([]));
  }, []);

  // The radar keeps "reading" stays one after another, like a live feed.
  useEffect(() => {
    if (!stays?.length) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [stays]);

  // Photo thumbnails pop in one by one during "사진 가져오기".
  useEffect(() => {
    if (!picked || step !== 1) return;
    const id = window.setInterval(() => setShown((n) => Math.min(n + 1, picked.previews.length)), 180);
    return () => window.clearInterval(id);
  }, [picked, step]);

  async function choose(stay: CatalogEntry) {
    setPicked(stay);
    setStep(0);
    setShown(0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const copy = api<{ project: Project }>(`/api/projects/${projectId}/catalog`, { method: "POST", json: { ideaId: stay.ideaId } });
    try {
      for (let i = 0; i < FILL_STEPS.length; i++) {
        setStep(i);
        await sleep(reduce ? 150 : STEP_MS[i]);
      }
      await editor.run(() => copy);
      toast.success(`${stay.name} 정보와 사진 ${stay.photoCount}장을 채웠어요.`);
      onDone?.();
    } catch (error) {
      toast.error(errorMessage(error));
      setPicked(null);
    }
  }

  /** Ranking stays have no saved photos: facts go in now, photos come from the listing link next step. */
  function chooseMapStay(stay: MapStay) {
    editor.change("product", (p) => ({ ...p, ...productFromMapStay(stay) }));
    editor.change("title", (t) => (t === "새 여행 숏폼" ? stay.name : t));
    toast.success(`${stay.name} 정보를 채웠어요. 다음 단계에서 숙소 링크로 사진을 가져오세요.`);
    onDone?.();
  }

  const tabs: { id: Tab; label: string; count?: string }[] = [
    { id: "ai", label: "AI 추천", count: stays?.length ? `${stays.length}곳` : undefined },
    { id: "ranking", label: "반응 랭킹", count: `${MAP_STAYS.length}곳` },
    { id: "map", label: "숙소 지도" },
  ];

  const lines = stays ? radarLines(stays) : [];
  const line = lines.length ? lines[tick % lines.length] : "";
  const scanning = stays?.length ? stays[Math.floor(tick / 2) % stays.length].ideaId : null;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-accent">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            AI 숙소 고르기
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.025em] sm:text-[34px]">요즘 잘 뜨는 숙소</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            다른 채널에서 반응이 검증된 숙소만 모았어요. 고르면 AI가 사진·숙소 정보를 알아서 채워요.
          </p>
        </div>
        {/* Live radar: a ticker of what the AI is reading right now. */}
        <div className="flex min-w-[280px] max-w-md flex-1 items-center gap-3 rounded-2xl border border-accent/20 bg-accent/[0.05] px-4 py-3">
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <span className="radar-sweep absolute inset-0 rounded-full" />
            <span className="relative size-2 rounded-full bg-accent" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-accent">AI 트렌드 레이더 · 실시간 수집 중</p>
            <p key={tick} className="ai-ticker truncate text-[13px] font-semibold text-fg">
              {line || "인스타·유튜브·틱톡 반응을 모으는 중…"}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-6 flex gap-1 border-b border-line" role="tablist" aria-label="숙소 찾는 방법">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-bold transition",
              tab === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.count ? <span className="tabular rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === "ranking" ? (
        <div className="relative mt-5">
          <StayRanking onPick={chooseMapStay} />
        </div>
      ) : null}

      {tab === "map" ? (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-line">
          <iframe
            title="메이의 숙소여행지도"
            src="/travel-map.html"
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            className="block h-[min(78dvh,820px)] w-full border-0 bg-[#f4f6f7]"
          />
          <p className="border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-muted">
            지도에서 마음에 드는 숙소를 찾으면 <button type="button" onClick={() => setTab("ranking")} className="font-bold text-accent underline-offset-2 hover:underline">반응 랭킹</button>에서 이름으로 검색해 바로 만들 수 있어요.
          </p>
        </div>
      ) : null}

      <div className={cx("relative mt-6", tab !== "ai" && "hidden")}>
        {/* A soft scan beam travels across the lookbook. */}
        <span aria-hidden className="scan-beam pointer-events-none absolute inset-y-0 z-10 w-40" />
        {stays === null ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : stays.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 p-6 text-center text-sm text-muted">아직 준비된 숙소가 없어요. 상품·사진 단계에서 링크로 가져와 주세요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {stays.map((stay, i) => (
              <button
                key={stay.ideaId}
                type="button"
                onClick={() => void choose(stay)}
                disabled={picked !== null}
                className={cx(
                  "group relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2 text-left shadow-[0_10px_30px_-18px_rgb(15_23_42/0.5)] outline-none transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_-20px_rgb(15_23_42/0.55)] focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait",
                  scanning === stay.ideaId && "ring-2 ring-accent/60",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- catalog media served by our own API */}
                <img src={fileUrl(stay.cover)} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.06]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {i < 3 ? <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-accent">TOP {i + 1}</span> : null}
                  {scanning === stay.ideaId ? (
                    <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
                      <span className="size-1.5 animate-pulse rounded-full bg-white" />
                      분석 중
                    </span>
                  ) : null}
                </div>
                <span className="tabular absolute top-3 right-3 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                  최고 {stay.topViews}만
                </span>
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="text-[11px] font-semibold tracking-wide text-white/75">{stay.region}</p>
                  <p className="mt-0.5 line-clamp-2 font-display text-lg leading-snug font-extrabold">{stay.name}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-white/85">{stay.pitch}</p>
                  <span className="mt-3 inline-flex translate-y-1 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-fg opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    이 숙소로 만들기 →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {picked ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/80 p-6 backdrop-blur-md" role="status" aria-live="polite">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_70px_-28px_rgb(15_23_42/0.5)]">
            <div className="relative h-28 bg-cover bg-center" style={{ backgroundImage: `url(${fileUrl(picked.cover)})` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <span aria-hidden className="scan-beam absolute inset-y-0 w-24" />
              <p className="absolute bottom-3 left-4 font-display text-xl font-extrabold text-white">{picked.name}</p>
            </div>
            <div className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
                AI가 숙소 정보를 채우는 중
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${((step + 1) / FILL_STEPS.length) * 100}%` }} />
              </div>
              <ol className="mt-4 flex flex-col gap-2.5">
                {FILL_STEPS.map((label, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <li key={label} className="text-[13px]">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cx(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border",
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
                        <span className={cx("font-semibold", done || active ? "text-fg" : "text-faint")}>
                          {label}
                          {i === 1 && (done || active) ? <span className="tabular ml-1.5 text-xs text-accent">{picked.photoCount}장</span> : null}
                        </span>
                      </div>
                      {i === 1 && (done || active) ? (
                        <div className="mt-2 ml-7 flex gap-1.5">
                          {picked.previews.slice(0, done ? picked.previews.length : shown).map((src) => (
                            // eslint-disable-next-line @next/next/no-img-element -- catalog media served by our own API
                            <img key={src} src={fileUrl(src)} alt="" className="ai-pop size-9 rounded-md object-cover" />
                          ))}
                        </div>
                      ) : null}
                      {i === 2 && (done || active) ? (
                        <p className="mt-1 ml-7 text-xs leading-relaxed text-muted">
                          {picked.region} · {picked.stayType}
                          {picked.rating ? ` · 평점 ${picked.rating}` : ""}
                          <br />
                          {picked.features.slice(0, 4).join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
