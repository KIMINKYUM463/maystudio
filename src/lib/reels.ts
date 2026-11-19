/**
 * Reel snapshots and the "오늘 터진 릴스" math. Pure: the collector (server/reel-collector.ts) feeds it,
 * the map's hot tab reads computeHot()'s output (same shape as the map file's built-in HOT).
 */

const HOUR = 3_600_000;
const HOT_WINDOW_H = 72;
const KEEP_DAYS = 14;
const MAX_SNAPS = 60;

/** [time ms, views, likes, comments] */
export type Snap = [number, number, number, number];

export type StoredReel = {
  code: string;
  account: string;
  caption: string;
  postedAt: number;
  thumb?: string;
  snaps: Snap[];
};

export type ReelStore = {
  reels: Record<string, StoredReel>;
  runs: number;
  lastRun?: number;
  lastError?: string;
  failed?: { account: string; error: string }[];
};

export const emptyReelStore = (): ReelStore => ({ reels: {}, runs: 0 });

/** One media object from Business Discovery. */
export type DiscoveredMedia = {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp?: string;
  media_product_type?: string;
  like_count?: number;
  comments_count?: number;
  view_count?: number;
  thumbnail_url?: string;
};

export function reelCode(permalink = ""): string {
  return permalink.match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? "";
}

/** Adds one collection run's media for an account; only reels with a view count are kept. */
export function mergeMedia(store: ReelStore, account: string, media: DiscoveredMedia[], now: number): number {
  let added = 0;
  for (const m of media) {
    if (m.media_product_type && m.media_product_type !== "REELS") continue;
    const code = reelCode(m.permalink);
    const postedAt = Date.parse(m.timestamp ?? "");
    if (!code || !Number.isFinite(postedAt) || typeof m.view_count !== "number") continue;
    const reel = (store.reels[m.id] ??= { code, account, caption: "", postedAt, snaps: [] });
    reel.caption = (m.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    if (m.thumbnail_url) reel.thumb = m.thumbnail_url;
    reel.snaps.push([now, m.view_count, m.like_count ?? 0, m.comments_count ?? 0]);
    if (reel.snaps.length > MAX_SNAPS) reel.snaps.splice(0, reel.snaps.length - MAX_SNAPS);
    added++;
  }
  return added;
}

export function pruneReels(store: ReelStore, now: number): void {
  for (const [id, reel] of Object.entries(store.reels)) if (now - reel.postedAt > KEEP_DAYS * 24 * HOUR) delete store.reels[id];
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const KST = 9 * HOUR;
const two = (n: number) => String(n).padStart(2, "0");
function kst(ms: number, withYear: boolean): string {
  const d = new Date(ms + KST);
  const md = `${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  return withYear ? `${d.getUTCFullYear()}-${md}` : md;
}

/** Same fields the map's hot tab renders: v views, ph per hour, d24/c24 24h gains, x vs account median, boom. */
export type HotItem = {
  c: string;
  ch: string;
  p: string;
  age: number;
  v: number;
  lk: number;
  cm: number;
  x: number | null;
  ph: number;
  d24: number | null;
  dp: number | null;
  dph: number | null;
  c24: number | null;
  boom: 0 | 1;
  n: string;
  h: string;
  cap: string;
  t?: string;
};

export type HotFeed = { at: string; snaps: number; items: HotItem[] };

/** Gain since the last snapshot at or before `since`; whole count when the reel is younger than that. */
function gainSince(reel: StoredReel, since: number, index: 1 | 3): number | null {
  const last = reel.snaps.at(-1)!;
  if (reel.postedAt >= since) return last[index];
  const before = [...reel.snaps].reverse().find((s) => s[0] <= since);
  return before ? last[index] - before[index] : null;
}

/**
 * 떡상 rule from the map (user's own thresholds, 2026-10-13): within 24 hours, 100k views or 1,000 comments.
 * `stayOf` links a caption to a stay name when the caption names it.
 */
export function computeHot(store: ReelStore, now: number, stayOf: (caption: string) => string = () => ""): HotFeed {
  const byAccount = new Map<string, number[]>();
  for (const reel of Object.values(store.reels)) {
    const list = byAccount.get(reel.account) ?? [];
    list.push(reel.snaps.at(-1)![1]);
    byAccount.set(reel.account, list);
  }
  const items: HotItem[] = [];
  for (const reel of Object.values(store.reels)) {
    const age = (now - reel.postedAt) / HOUR;
    if (age > HOT_WINDOW_H || !reel.snaps.length) continue;
    const [, v, lk, cm] = reel.snaps.at(-1)!;
    const prev = reel.snaps.at(-2);
    const d24 = gainSince(reel, now - 24 * HOUR, 1);
    const c24 = gainSince(reel, now - 24 * HOUR, 3);
    const mid = median(byAccount.get(reel.account) ?? []);
    items.push({
      c: reel.code,
      ch: reel.account,
      p: kst(reel.postedAt, false),
      age: Math.round(age * 10) / 10,
      v,
      lk,
      cm,
      x: mid > 0 ? Math.round((v / mid) * 10) / 10 : null,
      ph: Math.round(v / Math.max(age, 0.5)),
      d24,
      dp: prev ? v - prev[1] : null,
      dph: prev ? Math.round(((reel.snaps.at(-1)![0] - prev[0]) / HOUR) * 10) / 10 : null,
      c24,
      boom: (d24 ?? 0) >= 100_000 || (c24 ?? 0) >= 1_000 ? 1 : 0,
      n: "",
      h: stayOf(reel.caption),
      cap: reel.caption,
      ...(reel.thumb ? { t: reel.thumb } : {}),
    });
  }
  items.sort((a, b) => b.ph - a.ph);
  return { at: store.lastRun ? kst(store.lastRun, true) : "", snaps: store.runs, items };
}

/** "@a, b\nhttps://instagram.com/c/" → ["a","b","c"] */
export function parseAccounts(text: string): string[] {
  const names = text
    .split(/[\s,]+/)
    .map((t) => t.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/^@/, "").split(/[/?]/)[0].trim())
    .filter((t) => /^[A-Za-z0-9._]{1,30}$/.test(t));
  return [...new Set(names.map((n) => n.toLowerCase()))];
}
