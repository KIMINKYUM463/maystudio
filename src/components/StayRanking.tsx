"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { cx } from "@/components/ui";
import { formatViews, MAP_STAYS, MAP_TYPES, type MapStay } from "@/lib/stay-map";

type Sort = "views" | "latest" | "channels";
const SORTS: { id: Sort; label: string }[] = [
  { id: "views", label: "조회수순" },
  { id: "latest", label: "최근 뜬 순" },
  { id: "channels", label: "여러 채널이 올린 순" },
];
const PAGE = 30;
const DAY = 86_400_000;
/** "Rising" is measured against the newest reel in the data, so it doesn't drift as the data ages. */
const NEWEST = Math.max(...MAP_STAYS.map((s) => Date.parse(s.latest) || 0));
const MAX_VIEWS = MAP_STAYS[0]?.views ?? 1;
const TOTAL_REELS = MAP_STAYS.reduce((n, s) => n + s.reels, 0);
const PROVINCES = [...new Set(MAP_STAYS.map((s) => s.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));

const isRising = (s: MapStay) => NEWEST - (Date.parse(s.latest) || 0) <= 21 * DAY;

/**
 * Reaction ranking from 메이의 숙소여행지도: every stay other channels posted reels about, ranked by how
 * those reels did. Used in the project's first step and on the 숙소 추천 page.
 */
export function StayRanking({ onPick, busy }: { onPick: (stay: MapStay) => void; busy?: string | null }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("");
  const [province, setProvince] = useState("");
  const [sort, setSort] = useState<Sort>("views");
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim());

  const rows = useMemo(() => {
    const list = MAP_STAYS.filter(
      (s) =>
        (!type || s.type === type) &&
        (!province || s.province === province) &&
        (!q || s.name.includes(q) || s.region.includes(q)),
    );
    if (sort === "latest") return [...list].sort((a, b) => b.latest.localeCompare(a.latest) || b.views - a.views);
    if (sort === "channels") return [...list].sort((a, b) => b.channels - a.channels || b.views - a.views);
    return list;
  }, [q, type, province, sort]);

  const chip = (active: boolean) =>
    cx(
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
      active ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:border-accent/40 hover:text-fg",
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/15 bg-accent/[0.04] px-4 py-3">
        <p className="text-[13px] text-muted">
          <span className="font-bold text-fg">릴스 {TOTAL_REELS.toLocaleString("ko-KR")}개</span>의 조회수·댓글을 숙소별로 모았어요.
          <span className="ml-1 font-semibold text-accent">숙소 {MAP_STAYS.length}곳</span>
        </p>
        <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="정렬">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={sort === s.id}
              onClick={() => setSort(s.id)}
              className={cx(
                "rounded-full px-3 py-1 text-xs font-bold transition",
                sort === s.id ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="숙소 이름·지역 검색"
          aria-label="숙소 검색"
          className="h-9 w-full rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-accent sm:w-56"
        />
        <select
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setLimit(PAGE);
          }}
          aria-label="지역"
          className="h-9 rounded-full border border-line bg-surface px-3 text-sm font-semibold"
        >
          <option value="">전국</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="button" className={chip(type === "")} onClick={() => setType("")}>
          전체
        </button>
        {MAP_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={chip(type === t)}
            onClick={() => {
              setType(t);
              setLimit(PAGE);
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-surface-2 p-6 text-center text-sm text-muted">조건에 맞는 숙소가 없어요.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {rows.slice(0, limit).map((stay, i) => (
            <li
              key={stay.name}
              className="group grid grid-cols-[2.25rem_1fr] items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-3 transition hover:border-accent/30 hover:shadow-[var(--shadow-card)] sm:grid-cols-[2.5rem_1fr_auto] sm:px-4"
            >
              <span
                className={cx(
                  "tabular text-center font-display text-xl font-extrabold",
                  i < 3 ? "text-accent" : "text-faint",
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-bold">{stay.name}</p>
                  {isRising(stay) ? (
                    <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-600">요즘 뜸</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {stay.region} · {stay.type}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent"
                      style={{ width: `${Math.max(3, (stay.views / MAX_VIEWS) * 100)}%` }}
                    />
                  </div>
                  <span className="tabular shrink-0 text-xs font-bold text-fg">{formatViews(stay.views)}회</span>
                </div>
                <p className="tabular mt-1 text-[11px] text-faint">
                  릴스 {stay.reels}개 · 채널 {stay.channels}곳 · 댓글 {formatViews(stay.comments)} · 최근 {stay.latest}
                </p>
              </div>
              <div className="col-span-2 flex gap-2 sm:col-span-1 sm:flex-col sm:items-stretch">
                <button
                  type="button"
                  onClick={() => onPick(stay)}
                  disabled={Boolean(busy)}
                  className="flex-1 rounded-full bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90 disabled:opacity-50"
                >
                  {busy === stay.name ? "준비 중…" : "이 숙소로 만들기"}
                </button>
                <a
                  href={stay.topReel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-full border border-line px-4 py-2 text-center text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-fg"
                >
                  최고 릴스 {formatViews(stay.topReel.views)} ↗
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}
      {rows.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="mt-3 w-full rounded-full border border-line py-2.5 text-sm font-semibold text-muted transition hover:border-accent/40 hover:text-fg"
        >
          더 보기 ({rows.length - limit}곳 남음)
        </button>
      ) : null}
    </div>
  );
}
