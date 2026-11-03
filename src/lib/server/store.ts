import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  projectSchema,
  settingsSchema,
  type Project,
  type Settings,
} from "../types";
import { createEmptyProject } from "../project-factory";

export const DATA_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.MAYSTUDIO_DATA_DIR ?? path.join(process.cwd(), "data"),
);
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const CLICKS_FILE = path.join(DATA_DIR, "clicks.json");

const ID_PATTERN = /^[A-Za-z0-9_-]{6,24}$/;

export class NotFoundError extends Error {}

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function newId(): string {
  return randomBytes(6).toString("base64url");
}

/** Resolves a path relative to DATA_DIR and rejects anything escaping it. */
export function resolveDataPath(relative: string): string {
  const resolved = path.resolve(DATA_DIR, relative);
  if (resolved !== DATA_DIR && !resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error("Invalid path");
  }
  return resolved;
}

export function projectDir(id: string): string {
  if (!isValidId(id)) throw new NotFoundError(`Invalid project id: ${id}`);
  return path.join(PROJECTS_DIR, id);
}

/** Path of a project-relative file (e.g. "assets/a.jpg"), guarded against traversal. */
export function projectFilePath(id: string, relative: string): string {
  return resolveDataPath(path.join("projects", id, relative));
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function getProject(id: string): Promise<Project> {
  const raw = await readJson<unknown>(path.join(projectDir(id), "project.json"));
  if (!raw) throw new NotFoundError(`Project not found: ${id}`);
  return projectSchema.parse(raw);
}

export async function saveProject(project: Project): Promise<Project> {
  const next = projectSchema.parse({ ...project, updatedAt: new Date().toISOString() });
  await writeJsonAtomic(path.join(projectDir(project.id), "project.json"), next);
  return next;
}

export async function updateProject(
  id: string,
  mutate: (project: Project) => Project | Promise<Project>,
): Promise<Project> {
  const current = await getProject(id);
  return saveProject(await mutate(current));
}

/** New projects start on the benchmark template and inherit the brand logo saved in settings. */
export async function createProject(defaults: Partial<Settings> = {}): Promise<Project> {
  const project = createEmptyProject(newId(), new Date().toISOString(), defaults);
  const assetsDir = path.join(projectDir(project.id), "assets");
  await fs.mkdir(assetsDir, { recursive: true });
  let logoFile: string | undefined;
  if (defaults.brandLogoFile) {
    const name = `logo-${newId()}${path.extname(defaults.brandLogoFile)}`;
    try {
      await fs.copyFile(resolveDataPath(defaults.brandLogoFile), path.join(assetsDir, name));
      logoFile = path.posix.join("assets", name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return saveProject({ ...project, style: { ...project.style, template: "review", logoFile } });
}

/** Benchmark captions say "프로필링크 N번"; numbers only grow so old posts keep pointing at the right link. */
export async function nextLinkNumber(): Promise<number> {
  const used = (await listProjects()).map((p) => p.copy.linkNumber ?? 0);
  return Math.max(0, ...used) + 1;
}

export const BRAND_DIR = "brand";

/** Copies a project's media (not its renders) under a new id; `mutate` shapes the copy. */
export async function duplicateProject(id: string, mutate: (copy: Project) => Project): Promise<Project> {
  const source = await getProject(id);
  const copyId = newId();
  const from = projectDir(id);
  const skip = new Set(["project.json", "out"]);
  await fs.cp(from, projectDir(copyId), {
    recursive: true,
    filter: (src) => !skip.has(path.relative(from, src).split(path.sep)[0]),
  });
  const copy: Project = {
    ...source,
    id: copyId,
    createdAt: new Date().toISOString(),
    status: source.scenes.length ? "scripted" : "draft",
    render: { status: "idle", progress: 0, carouselFiles: [] },
    stats: { views: 0 },
  };
  return saveProject(mutate(copy));
}

export async function listProjects(): Promise<Project[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(PROJECTS_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const projects = await Promise.all(
    entries.filter(isValidId).map((id) => getProject(id).catch(() => null)),
  );
  return projects
    .filter((p): p is Project => p !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string): Promise<void> {
  await fs.rm(projectDir(id), { recursive: true, force: true });
}

export async function getSettings(): Promise<Settings> {
  return settingsSchema.parse((await readJson<unknown>(SETTINGS_FILE)) ?? {});
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const next = settingsSchema.parse(settings);
  await writeJsonAtomic(SETTINGS_FILE, next);
  return next;
}

type ClickLog = Record<string, { total: number; byDay: Record<string, number> }>;

export async function recordClick(projectId: string, now = new Date()): Promise<void> {
  const log = (await readJson<ClickLog>(CLICKS_FILE)) ?? {};
  const day = now.toISOString().slice(0, 10);
  const entry = log[projectId] ?? { total: 0, byDay: {} };
  entry.total += 1;
  entry.byDay[day] = (entry.byDay[day] ?? 0) + 1;
  log[projectId] = entry;
  await writeJsonAtomic(CLICKS_FILE, log);
}

export async function getClicks(): Promise<ClickLog> {
  return (await readJson<ClickLog>(CLICKS_FILE)) ?? {};
}
