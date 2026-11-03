"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/toast";
import { api, errorMessage } from "@/lib/client/api";
import type { MaskedSettings } from "@/lib/settings-view";
import type { Project, ProjectPatch } from "@/lib/types";

export type SaveState = "idle" | "saving" | "saved" | "error";
type EditableKey = "title" | "hookAngle" | "product" | "style" | "voice" | "copy" | "scenes" | "assets";
type Updater<T> = T | ((prev: T) => T);

const AUTOSAVE_DELAY_MS = 700;

function toPatch(project: Project, keys: Iterable<EditableKey>): ProjectPatch {
  const patch: ProjectPatch = {};
  for (const key of keys) {
    if (key === "assets") patch.assets = project.assets.map(({ id, label }) => ({ id, label }));
    else if (key === "style") {
      const style = { ...project.style };
      delete style.bgmFile;
      patch.style = style;
    } else Object.assign(patch, { [key]: project[key] });
  }
  return patch;
}

/**
 * Local-first project state: edits apply instantly, are batched per top-level
 * field and PATCHed after a short pause. Server actions call `flush()` first so
 * they always run on the latest saved data.
 */
export function useProjectEditor(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const projectRef = useRef<Project | null>(null);
  const dirty = useRef(new Set<EditableKey>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: Project) => {
    projectRef.current = next;
    setProject(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ project: Project }>(`/api/projects/${id}`)
      .then(({ project }) => !cancelled && commit(project))
      .catch((error) => !cancelled && setLoadError(errorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [id, commit]);

  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    const current = projectRef.current;
    if (!current || dirty.current.size === 0) return queue.current;
    const patch = toPatch(current, dirty.current);
    dirty.current.clear();
    setSaveState("saving");
    queue.current = queue.current.then(() =>
      api(`/api/projects/${id}`, { method: "PATCH", json: patch, keepalive: true }).then(
        () => setSaveState(dirty.current.size ? "saving" : "saved"),
        (error) => {
          // Re-queue the failed fields so the next edit or flush retries them.
          for (const key of Object.keys(patch) as EditableKey[]) dirty.current.add(key);
          setSaveState("error");
          toast.error(`자동 저장 실패: ${errorMessage(error)}`);
        },
      ),
    );
    return queue.current;
  }, [id]);

  const change = useCallback(
    <K extends EditableKey>(key: K, value: Updater<Project[K]>) => {
      const current = projectRef.current;
      if (!current) return;
      const nextValue =
        typeof value === "function" ? (value as (prev: Project[K]) => Project[K])(current[key]) : value;
      commit({ ...current, [key]: nextValue });
      dirty.current.add(key);
      setSaveState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [commit, flush],
  );

  /** Saves pending edits, runs a server action, then adopts the project it returns. */
  const run = useCallback(
    async <T extends { project: Project }>(action: () => Promise<T>): Promise<T> => {
      await flush();
      const result = await action();
      dirty.current.clear();
      commit(result.project);
      return result;
    },
    [flush, commit],
  );

  /** Merges server-owned render fields without touching local edits. */
  const syncRender = useCallback(
    (render: Project["render"], status?: Project["status"]) => {
      const current = projectRef.current;
      if (current) commit({ ...current, render, status: status ?? current.status });
    },
    [commit],
  );

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, [flush]);

  return { project, loadError, saveState, change, flush, run, syncRender };
}

export type ProjectEditor = ReturnType<typeof useProjectEditor>;

export type StepProps = {
  project: Project;
  editor: ProjectEditor;
  settings: MaskedSettings | null;
};
