/**
 * Spoken-style subtitles (benchmark @heo.jinny.gogo): the narration is shown a few words at a
 * time ("사우나를 / 내 방처럼 쓸 수 있는 / 숙소가 있어요"), each chunk ~0.9s, synced to speech.
 */
const MAX_CHUNK_CHARS = 9;
const MIN_CHUNK_CHARS = 4;
/** Word endings (particles, connective endings) after which Korean subtitles naturally break. */
const BREAK_AFTER = /[를을는은가이도에서고데면게며니까서]$/;
const PUNCTUATION_END = /[,.!?~]$/;
/** A chunk's screen time grows with its length plus a fixed beat for the pause between chunks. */
const CHUNK_PAUSE_WEIGHT = 1.5;

/** Benchmark reels speak ~115 visible characters in 16.5s. */
const SPEECH_CHARS_PER_SEC = 7;

const visibleLength = (text: string) => text.replace(/\s/g, "").length;

/** Screen time a narration line needs at the benchmark's speaking pace (scene limits: 1.5~10s). */
export function speechSeconds(text: string): number {
  return Math.min(10, Math.max(1.5, Math.round((visibleLength(text) / SPEECH_CHARS_PER_SEC) * 10) / 10));
}

export function subtitleChunks(text: string): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && visibleLength(`${current}${word}`) > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current} ${word}` : word;
    const length = visibleLength(current);
    if (PUNCTUATION_END.test(word) || length >= MAX_CHUNK_CHARS || (length >= MIN_CHUNK_CHARS && BREAK_AFTER.test(word))) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export type TimedChunk = { text: string; from: number; durationInFrames: number };

/** Spreads chunks over a scene in proportion to their length, so long phrases stay up longer. */
export function timeChunks(text: string, durationInFrames: number): TimedChunk[] {
  const chunks = subtitleChunks(text);
  if (chunks.length === 0 || durationInFrames <= 0) return [];
  const weights = chunks.map((c) => visibleLength(c) + CHUNK_PAUSE_WEIGHT);
  const total = weights.reduce((a, b) => a + b, 0);
  let elapsed = 0;
  return chunks.map((chunk, i) => {
    const from = Math.round((elapsed / total) * durationInFrames);
    elapsed += weights[i];
    const to = i === chunks.length - 1 ? durationInFrames : Math.round((elapsed / total) * durationInFrames);
    return { text: chunk, from, durationInFrames: Math.max(1, to - from) };
  });
}

/** Breaks a sentence into lines of about `maxChars` at word boundaries (carousel text, 2~3 lines). */
export function wrapLines(text: string, maxChars = 13): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxChars) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  // A lone short word on the last line ("좋아요.") reads as a mistake; pull it up.
  if (lines.length > 1 && visibleLength(lines[lines.length - 1]) <= MIN_CHUNK_CHARS) {
    const last = lines.pop();
    lines[lines.length - 1] += ` ${last}`;
  }
  return lines.join("\n");
}
