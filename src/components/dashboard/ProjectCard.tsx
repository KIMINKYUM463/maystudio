"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/components/toast";
import { Button, cx } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { clickRate, formatRate, funnelAdvice } from "@/lib/funnel";
import type { Project } from "@/lib/types";

export type ProjectSummary = Project & { clicks: number };

function coverUrl(p: Project): string | null {
  if (p.render.thumbnailFile) return projectFileUrl(p.id, p.render.thumbnailFile, p.render.finishedAt);
  return p.assets[0] ? projectFileUrl(p.id, p.assets[0].file) : null;
}

export function ProjectCard({
  project: p,
  number,
  recent,
  busy,
  onRemove,
  onDuplicate,
  onUpdated,
}: {
  project: ProjectSummary;
  /** 1-based creation order, shown as "No.07". */
  number: number;
  /** One of the newest projects: gets a "최근" sticker and an accent ring. */
  recent: boolean;
  busy: boolean;
  onRemove: () => void;
  onDuplicate: () => void;
  onUpdated: (project: Project) => void;
}) {
  const cover = coverUrl(p);
  const [views, setViews] = useState(String(p.stats.views || ""));
  const advice = funnelAdvice(p.stats.views, p.clicks);

  async function saveViews() {
    const next = Number(views.replace(/[^\d]/g, "")) || 0;
    if (next === p.stats.views) return;
    try {
      const { project } = await api<{ project: Project }>(`/api/projects/${p.id}`, {
        method: "PATCH",
        json: { stats: { views: next } },
      });
      onUpdated(project);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-surface transition hover:border-accent/60",
        recent ? "border-accent shadow-[0_18px_36px_-18px_rgb(44_95_214/0.55)] ring-2 ring-accent/25" : "border-line",
      )}
    >
      <Link href={`/projects/${p.id}`} className="block">
        <div className="relative aspect-[9/16] bg-surface-2">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- user media served by our own API
            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">🏝️</div>
          )}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <span className="tabular rounded-lg bg-black/65 px-2 py-1 text-xs font-bold tracking-wide text-white backdrop-blur-sm">
              No.{String(number).padStart(2, "0")}
            </span>
            {recent ? (
              <span className="-rotate-3 rounded-lg bg-accent px-2 py-1 text-xs font-extrabold text-white shadow-[0_4px_10px_-2px_rgb(44_95_214/0.6)]">
                최근
              </span>
            ) : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
            <span className="inline-flex rounded-[10px] bg-white">
              <StatusBadge status={p.status} />
            </span>
            <p className="mt-1.5 line-clamp-2 text-sm font-bold text-white">{p.title}</p>
          </div>
        </div>
      </Link>
      <div className="flex flex-col gap-2 p-3 text-xs text-muted">
        <div className="grid grid-cols-3 gap-1 text-center">
          <label className="flex flex-col gap-0.5">
            <span>조회수</span>
            <input
              inputMode="numeric"
              aria-label={`${p.title} 조회수`}
              placeholder="입력"
              className="w-full rounded-md border border-line bg-surface-2 px-1 py-0.5 text-center text-fg"
              value={views}
              onChange={(e) => setViews(e.target.value)}
              onBlur={saveViews}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </label>
          <div className="flex flex-col gap-0.5">
            <span>클릭</span>
            <span className="py-0.5 font-bold text-fg">{p.clicks}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span>클릭률</span>
            <span className="py-0.5 font-bold text-fg">{formatRate(clickRate(p.stats.views, p.clicks))}</span>
          </div>
        </div>
        {advice ? <p className={cx(advice.tone === "warning" ? "text-warning" : "text-success")}>{advice.text}</p> : null}
        <Button size="sm" onClick={onDuplicate} loading={busy} disabled={busy || p.scenes.length === 0}>
          훅만 바꿔 다시 만들기
        </Button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${p.title} 삭제`}
        className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        삭제
      </button>
    </div>
  );
}
