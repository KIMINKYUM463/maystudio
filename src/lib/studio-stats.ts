import type { Project } from "./types";

/** Average render wall time of finished videos, in seconds; null when none has both timestamps. */
export function averageRenderSeconds(projects: Pick<Project, "render">[]): number | null {
  const times = projects
    .filter((p) => p.render.status === "done" && p.render.startedAt && p.render.finishedAt)
    .map((p) => (Date.parse(p.render.finishedAt!) - Date.parse(p.render.startedAt!)) / 1000)
    .filter((s) => Number.isFinite(s) && s > 0);
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
}

/** 160 → "2분 40초", 45 → "45초". */
export function formatMinutes(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? (s ? `${m}분 ${s}초` : `${m}분`) : `${s}초`;
}

/** Photos that already carry an AI (or uploaded) motion clip. */
export function clipCount(projects: Pick<Project, "assets">[]): number {
  return projects.reduce((sum, p) => sum + p.assets.filter((a) => a.videoFile).length, 0);
}
