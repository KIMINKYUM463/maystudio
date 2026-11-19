import { computeHot, emptyReelStore, mergeMedia, parseAccounts, pruneReels, type DiscoveredMedia, type ReelStore } from "../reels";
import { MAP_STAYS } from "../stay-map";
import type { Settings } from "../types";
import { getSettings, readReelStore, saveSettings, writeReelStore } from "./store";

// Unversioned: Meta serves the app's default API version.
const GRAPH = "https://graph.facebook.com";
const MEDIA_FIELDS = "id,caption,permalink,timestamp,media_product_type,like_count,comments_count,view_count";
const REFRESH_AFTER_DAYS = 30;

type Fetch = typeof fetch;

async function graph<T>(path: string, params: Record<string, string>, fetchImpl: Fetch): Promise<T> {
  const url = `${GRAPH}/${path}?${new URLSearchParams(params)}`;
  const res = await fetchImpl(url);
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || body.error) {
    const code = body.error?.code;
    // 190 = token expired/invalid; 4/17/32/613 = rate limits.
    if (code === 190) throw new Error("메타 연결 키가 만료됐거나 잘못됐어요. 설정에서 새 키를 넣어 주세요.");
    if (code && [4, 17, 32, 613].includes(code)) throw new Error("메타 호출 한도에 걸렸어요. 잠시 뒤 자동으로 다시 시도해요.");
    throw new Error(body.error?.message || `메타 응답 오류 (${res.status})`);
  }
  return body;
}

/** Finds the user's Instagram professional account id from a Facebook-login token (via the linked Page). */
export async function findIgUser(token: string, fetchImpl: Fetch = fetch): Promise<{ id: string; username: string }> {
  const { data } = await graph<{ data: { instagram_business_account?: { id: string; username?: string } }[] }>(
    "me/accounts",
    { fields: "instagram_business_account{id,username}", access_token: token },
    fetchImpl,
  );
  const ig = data.find((page) => page.instagram_business_account)?.instagram_business_account;
  if (!ig) throw new Error("이 키에 연결된 인스타그램 프로페셔널 계정을 찾지 못했어요. 페이스북 페이지에 인스타 계정이 연결돼 있는지 확인해 주세요.");
  return { id: ig.id, username: ig.username ?? "" };
}

/** Long-lived tokens last ~60 days; exchanging one before expiry returns a fresh one. Needs the app id/secret. */
async function refreshToken(settings: Settings, now: number, fetchImpl: Fetch): Promise<Settings> {
  if (!settings.metaAppId || !settings.metaAppSecret) return settings;
  const last = Date.parse(settings.metaTokenRefreshedAt) || 0;
  if (now - last < REFRESH_AFTER_DAYS * 86_400_000) return settings;
  const { access_token } = await graph<{ access_token: string }>(
    "oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: settings.metaAppId,
      client_secret: settings.metaAppSecret,
      fb_exchange_token: settings.metaToken,
    },
    fetchImpl,
  );
  return saveSettings({ ...settings, metaToken: access_token, metaTokenRefreshedAt: new Date(now).toISOString() });
}

async function discover(settings: Settings, account: string, fetchImpl: Fetch): Promise<DiscoveredMedia[]> {
  const ask = (fields: string) =>
    graph<{ business_discovery?: { media?: { data?: DiscoveredMedia[] } } }>(
      settings.igUserId,
      { fields: `business_discovery.username(${account}){media.limit(25){${fields}}}`, access_token: settings.metaToken },
      fetchImpl,
    );
  // Thumbnails make the list nicer but some accounts' media reject the field; fall back without it.
  const body = await ask(`${MEDIA_FIELDS},thumbnail_url`).catch(() => ask(MEDIA_FIELDS));
  return body.business_discovery?.media?.data ?? [];
}

const squash = (s: string) => s.toLowerCase().replace(/[\s·()]/g, "");
const STAY_KEYS = MAP_STAYS.map((s) => [squash(s.name), s.name] as const).filter(([k]) => k.length >= 4);

/** Caption names a stay from the map → that stay. shortcut: exact name only; AI matching if this misses too often. */
export function stayFromCaption(caption: string): string {
  const text = squash(caption);
  return STAY_KEYS.find(([key]) => text.includes(key))?.[1] ?? "";
}

export async function loadReelStore(): Promise<ReelStore> {
  return (await readReelStore<ReelStore>()) ?? emptyReelStore();
}

export async function hotFeed(now = Date.now()) {
  return computeHot(await loadReelStore(), now, stayFromCaption);
}

let running: Promise<ReelStore> | null = null;

/** One collection run over every watched account. Concurrent calls share the same run. */
export function collectReels(fetchImpl: Fetch = fetch, now = Date.now()): Promise<ReelStore> {
  running ??= (async () => {
    const store = await loadReelStore();
    try {
      let settings = await getSettings();
      const accounts = parseAccounts(settings.reelAccounts);
      if (!settings.metaToken || !settings.igUserId) throw new Error("설정에서 메타 연결을 먼저 해 주세요.");
      if (!accounts.length) throw new Error("지켜볼 인스타 계정을 설정에 넣어 주세요.");
      settings = await refreshToken(settings, now, fetchImpl);
      const failed: ReelStore["failed"] = [];
      for (const account of accounts) {
        try {
          mergeMedia(store, account, await discover(settings, account, fetchImpl), now);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failed.push({ account, error: message });
          if (/만료|한도/.test(message)) break; // every next call would fail the same way
        }
      }
      pruneReels(store, now);
      store.runs += 1;
      store.lastRun = now;
      store.failed = failed;
      store.lastError = failed.length === accounts.length ? failed[0]?.error : undefined;
    } catch (error) {
      store.lastError = error instanceof Error ? error.message : String(error);
    }
    await writeReelStore(store);
    return store;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Called hourly by instrumentation.ts; collects when the chosen interval has passed. */
export async function collectIfDue(now = Date.now()): Promise<void> {
  const settings = await getSettings();
  if (!settings.metaToken || !settings.igUserId || !parseAccounts(settings.reelAccounts).length) return;
  const { lastRun = 0 } = await loadReelStore();
  if (now - lastRun >= settings.reelIntervalHours * 3_600_000 - 60_000) await collectReels();
}
