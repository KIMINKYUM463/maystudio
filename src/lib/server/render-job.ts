import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Project } from "../types";
import { BadRequestError } from "./http";
import { getProject, projectDir, updateProject } from "./store";

const ACTIVE = new Set(["queued", "bundling", "rendering"]);
/** A render that hasn't finished in this long is treated as crashed. */
const STALE_MS = 20 * 60 * 1000;

export function isRenderActive(project: Project, now = Date.now()): boolean {
  if (!ACTIVE.has(project.render.status)) return false;
  const started = project.render.startedAt ? Date.parse(project.render.startedAt) : 0;
  return now - started < STALE_MS;
}

export async function startRender(id: string): Promise<Project> {
  const project = await getProject(id);
  if (isRenderActive(project)) throw new BadRequestError("이미 렌더링 중입니다.");
  if (project.scenes.length === 0) throw new BadRequestError("대본(장면)이 없습니다. 먼저 대본을 생성하세요.");

  const queued = await updateProject(id, (p) => ({
    ...p,
    status: "rendering",
    render: { status: "queued", progress: 0, carouselFiles: [], startedAt: new Date().toISOString() },
  }));

  const cwd = process.cwd();
  const tsxCli = path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs");
  const log = await fs.open(path.join(projectDir(id), "render.log"), "w");
  try {
    const child = spawn(process.execPath, [tsxCli, path.join(cwd, "scripts", "render.ts"), id], {
      cwd,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", log.fd, log.fd],
      env: process.env,
    });
    child.unref();
  } finally {
    await log.close();
  }
  return queued;
}
