/**
 * One real-review line for the "⭐ 실제 후기" card. Comes from the listing's best review (Coupang import
 * writes "베스트 리뷰: 제목 - 본문" into notes). Kept verbatim apart from trimming: it is shown as a quote,
 * so it must not be reworded.
 */
const MAX = 60;

export function quoteFromReview(title?: string, content?: string): string {
  const text = (content || title || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  // First sentence that says something (at least 8 characters), cut at a word boundary if still long.
  // Split at punctuation only: "피로가 다 풀렸어요" has a "다 " that is not a sentence end.
  const sentences = text.split(/(?<=[.!?…~])\s+/).map((s) => s.trim()).filter((s) => s.length >= 8);
  const first = sentences[0] ?? text;
  if (first.length <= MAX) return first;
  const cut = first.slice(0, MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), MAX - 10)).trim()}…`;
}

export function quoteFromNotes(notes: string): string {
  const line = notes.split("\n").find((l) => l.startsWith("베스트 리뷰:"));
  if (!line) return "";
  const body = line.replace(/^베스트 리뷰:\s*/, "");
  const [title, ...rest] = body.split(" - ");
  return quoteFromReview(title, rest.join(" - ") || title);
}
