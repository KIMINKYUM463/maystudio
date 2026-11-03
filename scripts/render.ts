/**
 * Render worker: `tsx scripts/render.ts <projectId>`.
 * Runs outside Next.js so Remotion's webpack bundler and Chromium never get
 * pulled into the app bundle. Progress is persisted to project.json.
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, promises as fs } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { DATA_DIR, getProject, projectDir, resolveDataPath, updateProject } from "../src/lib/server/store";
import { buildVideoProps, carouselSlides, type CarouselProps, type VideoProps } from "../src/lib/video/props";
import type { RenderState } from "../src/lib/types";

const ROOT = process.cwd();
const ENTRY = path.join(ROOT, "src", "remotion", "index.ts");
const SOURCE_DIRS = [path.join(ROOT, "src", "remotion"), path.join(ROOT, "src", "lib")];

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

let writeQueue: Promise<unknown> = Promise.resolve();

/** Writes are chained so a late progress update can never overwrite "done". */
function setRender(id: string, patch: Partial<RenderState>, status?: "rendering" | "done" | "error") {
  const next = writeQueue.then(() =>
    updateProject(id, (p) => ({
      ...p,
      status: status ?? p.status,
      render: { ...p.render, ...patch },
    })),
  );
  writeQueue = next.catch(() => undefined);
  return next;
}

/** Serves DATA_DIR so Chromium can load project images/audio over HTTP. */
function startAssetServer(): Promise<{ origin: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname).replace(/^\/+/, "");
      const file = resolveDataPath(rel);
      if (!existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(400).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ origin: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

async function sourceHash(): Promise<string> {
  const hash = createHash("sha1");
  const walk = async (dir: string): Promise<void> => {
    for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        const stat = await fs.stat(full);
        hash.update(`${full}:${stat.size}:${stat.mtimeMs}`);
      }
    }
  };
  for (const dir of SOURCE_DIRS) await walk(dir);
  return hash.digest("hex").slice(0, 12);
}

async function getBundle(onProgress: (p: number) => void): Promise<string> {
  const outDir = path.join(DATA_DIR, ".bundle", await sourceHash());
  if (existsSync(path.join(outDir, "index.html"))) return outDir;
  await fs.rm(path.join(DATA_DIR, ".bundle"), { recursive: true, force: true });
  return bundle({ entryPoint: ENTRY, outDir, publicDir: path.join(ROOT, "public"), onProgress });
}

/** Renders the 4:5 feed carousel next to the reel; stale slides from a longer previous render are removed. */
async function renderCarousel(serveUrl: string, props: VideoProps, outDir: string): Promise<string[]> {
  for (const name of await fs.readdir(outDir)) {
    if (/^slide-\d+\.jpg$/.test(name)) await fs.rm(path.join(outDir, name), { force: true });
  }
  const files: string[] = [];
  for (let slideIndex = 0; slideIndex < carouselSlides(props).length; slideIndex++) {
    const inputProps: CarouselProps = { ...props, slideIndex };
    const composition = await selectComposition({ serveUrl, id: "CarouselSlide", inputProps });
    const name = `slide-${String(slideIndex + 1).padStart(2, "0")}.jpg`;
    await renderStill({ composition, serveUrl, output: path.join(outDir, name), imageFormat: "jpeg", jpegQuality: 92, inputProps });
    files.push(`out/${name}`);
  }
  return files;
}

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("Usage: tsx scripts/render.ts <projectId>");
  const startedAt = new Date().toISOString();
  await setRender(id, { status: "bundling", progress: 0, error: undefined, startedAt, finishedAt: undefined }, "rendering");

  const server = await startAssetServer();
  try {
    const serveUrl = await getBundle(() => undefined);
    const project = await getProject(id);
    if (project.scenes.length === 0) throw new Error("대본(장면)이 없습니다. 먼저 대본을 생성하세요.");
    const inputProps = buildVideoProps(project, (file) =>
      `${server.origin}/projects/${id}/${file.split(path.sep).join("/")}`,
    );

    const outDir = path.join(projectDir(id), "out");
    await fs.mkdir(outDir, { recursive: true });

    const composition = await selectComposition({ serveUrl, id: "TravelShort", inputProps });
    await setRender(id, { status: "rendering", progress: 0.02 });

    let lastSaved = 0;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 20,
      outputLocation: path.join(outDir, "video.mp4"),
      inputProps,
      onProgress: ({ progress }) => {
        if (progress - lastSaved >= 0.04) {
          lastSaved = progress;
          void setRender(id, { progress: Math.min(0.95, progress) }).catch(() => undefined);
        }
      },
    });

    const thumb = await selectComposition({ serveUrl, id: "Thumbnail", inputProps });
    await renderStill({
      composition: thumb,
      serveUrl,
      output: path.join(outDir, "thumbnail.jpg"),
      imageFormat: "jpeg",
      jpegQuality: 90,
      inputProps,
    });

    const carouselFiles = await renderCarousel(serveUrl, inputProps, outDir);

    await setRender(
      id,
      {
        status: "done",
        progress: 1,
        outputFile: "out/video.mp4",
        thumbnailFile: "out/thumbnail.jpg",
        carouselFiles,
        finishedAt: new Date().toISOString(),
      },
      "done",
    );
    console.log(`[render] done ${id}`);
  } finally {
    server.close();
  }
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[render] failed", error);
  const id = process.argv[2];
  if (id) {
    await setRender(id, { status: "error", error: message.slice(0, 500), finishedAt: new Date().toISOString() }, "error").catch(
      () => undefined,
    );
  }
  process.exit(1);
});
