"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { Button, Spinner, cx } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { averageRenderSeconds, clipCount, formatMinutes } from "@/lib/studio-stats";
import type { Project } from "@/lib/types";
import { AiPipelineCard } from "./AiPipelineCard";
import { HeroReel } from "./HeroReel";
import { PhotoMarquee } from "./PhotoMarquee";
import { IdeaPicker } from "./IdeaPicker";
import { ProjectCard, type ProjectSummary } from "./ProjectCard";

const STEPS = [
  { title: "숙소 고르기", body: "아래 20곳 중 하나를 고르거나, 쿠팡 트래블 링크를 붙여넣으면 사진 20장·편의시설·평점을 가져와요." },
  { title: "5단계 대본 자동 생성", body: "후킹 → 소구점 → 로망 → 여운 → 댓글 키워드. 숙소 이름은 숨기고 DM으로만 알려줘요." },
  { title: "릴스 MP4 완성", body: "배경 영상 위에 자막·로고 모션그래픽이 올라간 18~25초 세로 영상, 캡션·DM 문구까지 만들어요." },
];

const RECENT_COUNT = 3;

type CreateRequest = { demo?: boolean; ideaId?: string; duplicateOf?: string };

export function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  /** Which create action is running: "blank" | "demo" | an idea id | a project id being duplicated. */
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ projects: ProjectSummary[] }>("/api/projects")
      .then(({ projects }) => !cancelled && setProjects(projects))
      .catch((error) => {
        if (cancelled) return;
        toast.error(errorMessage(error));
        setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(key: string, json: CreateRequest) {
    setCreating(key);
    try {
      const { project } = await api<{ project: Project }>("/api/projects", { method: "POST", json });
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setCreating(null);
    }
  }

  async function remove(p: Project) {
    if (!confirm(`'${p.title}' 프로젝트를 삭제할까요? 사진과 영상도 함께 지워집니다.`)) return;
    try {
      await api(`/api/projects/${p.id}`, { method: "DELETE" });
      setProjects((list) => list?.filter((x) => x.id !== p.id) ?? null);
      toast.success("삭제했어요.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const replace = (updated: Project) =>
    setProjects((list) => list?.map((x) => (x.id === updated.id ? { ...updated, clicks: x.clicks } : x)) ?? null);

  const done = projects?.filter((p) => p.render.status === "done").length ?? 0;
  const renderSeconds = projects ? averageRenderSeconds(projects) : null;
  // Numbers follow creation order (oldest = 1) so a project keeps its number as the list re-sorts.
  const byCreation = [...(projects ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const numberOf = new Map(byCreation.map((p, i) => [p.id, i + 1]));
  const recentIds = new Set(byCreation.slice(-RECENT_COUNT).map((p) => p.id));
  // Hero phone plays the most recently finished reel; the animated mock stays until one exists.
  const latestReel = [...(projects ?? [])]
    .filter((p) => p.render.status === "done" && p.render.outputFile)
    .sort((a, b) => (b.render.finishedAt ?? "").localeCompare(a.render.finishedAt ?? ""))[0];
  const heroVideo = latestReel ? projectFileUrl(latestReel.id, latestReel.render.outputFile!, latestReel.render.finishedAt) : null;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <section className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div aria-hidden className="hero-aurora" />
        <div className="hero-enter min-w-0">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-accent">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            AI 여행 숏폼 자동 제작
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.2] font-extrabold tracking-[-0.03em] md:text-5xl lg:text-[58px]">
            숙소 사진 한 장이,
            <br />
            <span className="text-accent">여행 릴스</span>가 되는 곳
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
            숙소 링크 하나만 붙여넣으세요. 사진·대본·자막을 알아서 채워서, 바로 올릴 수 있는 20초 릴스로 만들어 드려요.
          </p>
          <div className="hero-enter-delay mt-6 flex flex-wrap gap-2">
            <Button
              size="lg"
              variant="primary"
              onClick={() => create("blank", {})}
              loading={creating === "blank"}
              disabled={creating !== null}
            >
              + 새 숏폼 만들기
            </Button>
          </div>
        </div>
        {/* Card sits beside the phone (never over it) on wide screens and under it on narrow ones. */}
        <div className="flex flex-col items-center gap-6 xl:flex-row xl:items-end">
          <AiPipelineCard className="hero-enter-delay order-2 xl:order-1 xl:mb-10" />
          <div className="order-1 w-[280px] max-w-full shrink-0 xl:order-2">
            <HeroReel videoSrc={heroVideo} />
          </div>
        </div>
      </section>

      {projects ? <PhotoMarquee refreshKey={projects.length} /> : null}

      {/* "My projects" is its own panel so it reads apart from the marketing hero above. */}
      <section
        aria-labelledby="projects-title"
        className="mt-16 rounded-[28px] border border-line bg-white/75 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm sm:p-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <h2 id="projects-title" className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
              내 숏폼 프로젝트
              {projects?.length ? (
                <span className="tabular ml-2 align-middle font-sans text-base font-bold text-accent">{projects.length}</span>
              ) : null}
            </h2>
            <p className="mt-1.5 text-sm text-muted">카드를 누르면 편집 화면으로 들어가요. 최근에 만든 3개에는 &lsquo;최근&rsquo; 표시가 붙어요.</p>
          </div>
          <Button variant="primary" onClick={() => create("blank", {})} loading={creating === "blank"} disabled={creating !== null}>
            + 새 숏폼 만들기
          </Button>
        </div>
        <section
          aria-label="내 성과"
          className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] md:grid-cols-4"
        >
          {[
            { label: "프로젝트", value: projects?.length ?? "-" },
            { label: "완성 영상", value: projects ? done : "-" },
            { label: "AI 영상 클립", value: projects ? `${clipCount(projects)}개` : "-" },
            { label: "영상 1개 평균 완성", value: renderSeconds === null ? "-" : formatMinutes(renderSeconds) },
          ].map((s, i) => (
            <div key={s.label} className={cx("px-5 py-4", i % 2 === 1 && "ticket-perf", i === 2 && "ticket-perf-md")}>
              <p className="text-xs font-semibold text-muted">{s.label}</p>
              <p className="tabular mt-1 text-2xl font-extrabold">{s.value}</p>
            </div>
          ))}
        </section>

        {projects === null ? (
          <div className="flex justify-center py-24 text-muted">
            <Spinner className="size-6" />
          </div>
        ) : projects.length === 0 ? (
          <section
            aria-label="만드는 순서"
            className="mt-10 grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-3"
          >
            {STEPS.map((s, i) => (
              <div key={s.title} className={cx("p-6", i > 0 && "border-t-2 border-dashed border-line md:border-t-0 ticket-perf-md")}>
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-black text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </section>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                number={numberOf.get(p.id) ?? 0}
                recent={recentIds.has(p.id)}
                busy={creating === p.id}
                onRemove={() => remove(p)}
                onDuplicate={() => create(p.id, { duplicateOf: p.id })}
                onUpdated={replace}
              />
            ))}
          </div>
        )}
      </section>

      {/* The stay list lives under "숙소 추천"; home shows it only before the first project. */}
      {projects?.length === 0 ? (
        <section className="mt-10">
          <IdeaPicker creatingId={creating} onCreate={(ideaId) => create(ideaId, { ideaId })} />
        </section>
      ) : null}
    </div>
  );
}
