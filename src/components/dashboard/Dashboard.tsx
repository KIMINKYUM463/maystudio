"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { Button, Card, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { clickRate, formatRate } from "@/lib/funnel";
import type { Project } from "@/lib/types";
import { HeroReel } from "./HeroReel";
import { IdeaPicker } from "./IdeaPicker";
import { ProjectCard, type ProjectSummary } from "./ProjectCard";

const STEPS = [
  { icon: "🏨", title: "숙소 고르기", body: "아래 20곳 중 하나를 고르거나, 쿠팡 트래블 링크를 붙여넣으면 사진 20장·편의시설·평점을 가져와요." },
  { icon: "✍️", title: "5단계 대본 자동 생성", body: "후킹 → 소구점 → 로망 → 여운 → 댓글 키워드. 숙소 이름은 숨기고 DM으로만 알려줘요." },
  { icon: "🎬", title: "릴스 MP4 완성", body: "배경 영상 위에 자막·로고 모션그래픽이 올라간 18~25초 세로 영상, 캡션·DM 문구까지 만들어요." },
];

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
  const clicks = projects?.reduce((sum, p) => sum + p.clicks, 0) ?? 0;
  const views = projects?.reduce((sum, p) => sum + p.stats.views, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,320px)]">
        <div className="hero-enter min-w-0">
          <p className="text-4xl font-black tracking-tight md:text-5xl lg:text-6xl">
            MayStudio
          </p>
          <h1 className="mt-3 max-w-xl text-xl font-bold tracking-tight text-fg md:text-2xl">
            숙소 사진이 <span className="text-accent">릴스</span>가 되는 곳
          </h1>
          <p className="mt-3 max-w-lg text-muted">
            배경 영상은 Replicate로, 자막·로고 모션그래픽은 Remotion으로. 링크만 있으면 18~25초 숏폼까지 이어져요.
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
            <Button
              size="lg"
              onClick={() => create("demo", { demo: true })}
              loading={creating === "demo"}
              disabled={creating !== null}
            >
              샘플로 체험하기
            </Button>
          </div>
        </div>
        <HeroReel />
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "프로젝트", value: projects?.length ?? "-" },
          { label: "완성 영상", value: projects ? done : "-" },
          { label: "조회수 → 링크 클릭", value: projects ? `${views.toLocaleString()} → ${clicks.toLocaleString()}` : "-" },
          { label: "클릭률", value: projects ? formatRate(clickRate(views, clicks)) : "-" },
        ].map((s) => (
          <Card key={s.label} className="py-4">
            <p className="text-xs font-semibold text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
          </Card>
        ))}
      </section>

      {projects === null ? (
        <div className="flex justify-center py-24 text-muted">
          <Spinner className="size-6" />
        </div>
      ) : projects.length === 0 ? (
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={s.title}>
              <p className="text-2xl">{s.icon}</p>
              <p className="mt-3 text-xs font-bold text-accent">STEP {i + 1}</p>
              <h3 className="mt-1 font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </Card>
          ))}
        </section>
      ) : (
        <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              busy={creating === p.id}
              onRemove={() => remove(p)}
              onDuplicate={() => create(p.id, { duplicateOf: p.id })}
              onUpdated={replace}
            />
          ))}
        </section>
      )}

      <section className="mt-10">
        <IdeaPicker creatingId={creating} onCreate={(ideaId) => create(ideaId, { ideaId })} />
      </section>
    </div>
  );
}
