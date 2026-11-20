import { execFile } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

/** Silence kept at each edge so words don't start or stop abruptly. */
const KEEP_SEC = 0.05;
/** Below this level counts as silence (TTS breaths and room tone sit around -50dB). */
const NOISE_DB = -40;

// shortcut: uses Remotion's bundled Windows ffmpeg (this app runs on one Windows PC), else ffmpeg on PATH.
const FFMPEG = (() => {
  const bundled = path.join(process.cwd(), "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffmpeg.exe");
  return existsSync(bundled) ? bundled : "ffmpeg";
})();

export type Silence = { start: number; end: number };

/** Parses ffmpeg silencedetect output; a silence still open at the end runs to `duration`. */
export function parseSilences(log: string, duration: number): Silence[] {
  const silences: Silence[] = [];
  let open: number | null = null;
  for (const match of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    const t = Number(match[2]);
    if (match[1] === "start") open = Math.max(0, t);
    else if (open !== null) {
      silences.push({ start: open, end: t });
      open = null;
    }
  }
  if (open !== null) silences.push({ start: open, end: duration });
  return silences;
}

/** The part worth keeping: drop leading and trailing silence, keep pauses inside the sentence. */
export function speechWindow(silences: Silence[], duration: number): { start: number; end: number } | null {
  const lead = silences.find((s) => s.start <= 0.01);
  const tail = silences.find((s) => s.end >= duration - 0.01 && s.start > 0.01);
  const start = lead ? Math.max(0, lead.end - KEEP_SEC) : 0;
  const end = tail ? Math.min(duration, tail.start + KEEP_SEC) : duration;
  // Nothing to trim, or the clip is (almost) all silence: leave it alone.
  if (end - start < 0.3 || (start < 0.02 && end > duration - 0.02)) return null;
  return { start, end };
}

/**
 * Cuts the silence TTS engines put before and after each line (0.2~0.45s each on Typecast), which
 * otherwise adds up to ~1s dead air between subtitles. Returns the input unchanged if anything fails.
 */
export async function trimSpeechSilence(buffer: Buffer, ext: string, duration: number): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "maystudio-tts-"));
  const input = path.join(dir, `in.${ext}`);
  const output = path.join(dir, "out.mp3");
  try {
    await fs.writeFile(input, buffer);
    const run = promisify(execFile);
    const detect = await run(FFMPEG, ["-hide_banner", "-i", input, "-af", `silencedetect=noise=${NOISE_DB}dB:d=0.08`, "-f", "null", "-"], {
      timeout: 30_000,
      maxBuffer: 4 << 20,
    });
    const window = speechWindow(parseSilences(`${detect.stdout}${detect.stderr}`, duration), duration);
    if (!window) return buffer;
    await run(
      FFMPEG,
      ["-hide_banner", "-y", "-i", input, "-af", `atrim=start=${window.start.toFixed(3)}:end=${window.end.toFixed(3)},asetpts=PTS-STARTPTS`, "-c:a", "libmp3lame", "-b:a", "128k", output],
      { timeout: 30_000 },
    );
    return await fs.readFile(output);
  } catch {
    return buffer;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
