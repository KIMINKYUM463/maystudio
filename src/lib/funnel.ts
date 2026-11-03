/**
 * Kit: read results as views → clicks → purchases and fix the first stage that leaks.
 * Thresholds are rough starting points for a new account, not platform benchmarks.
 */
const LOW_VIEWS = 1_000;
const LOW_CTR = 0.005;

export type FunnelAdvice = { tone: "warning" | "success"; text: string };

export function clickRate(views: number, clicks: number): number | null {
  return views > 0 ? clicks / views : null;
}

export function funnelAdvice(views: number, clicks: number): FunnelAdvice | null {
  const rate = clickRate(views, clicks);
  if (rate === null) return null;
  if (views < LOW_VIEWS) return { tone: "warning", text: "조회수가 적어요. 훅만 바꿔 다시 올려보세요." };
  if (rate < LOW_CTR) return { tone: "warning", text: "클릭이 적어요. 댓글 키워드·CTA를 바꿔보세요." };
  return { tone: "success", text: "반응이 좋아요. 비슷한 숙소로 더 만들어보세요." };
}

export function formatRate(rate: number | null): string {
  return rate === null ? "-" : `${(rate * 100).toFixed(rate < 0.01 ? 2 : 1)}%`;
}
