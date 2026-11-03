import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { resolveDataPath } from "@/lib/server/store";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

type Ctx = { params: Promise<{ path: string[] }> };

/** Serves media under data/projects only, with Range support for video/audio seeking. */
export async function GET(request: Request, { params }: Ctx) {
  const segments = (await params).path;
  if (segments[0] !== "projects") return new Response("Not found", { status: 404 });
  let file: string;
  try {
    file = resolveDataPath(segments.join("/"));
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw new Error("not a file");
    size = stat.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };
  if (url.searchParams.has("download")) {
    const name = url.searchParams.get("download") || path.basename(file);
    headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
  }

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
