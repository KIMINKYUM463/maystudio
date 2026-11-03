"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/components/toast";
import { Button, Card, Spinner, cx } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { llmReady, ttsReady, type MaskedSettings } from "@/lib/settings-view";
import type { Project } from "@/lib/types";
import { buildVideoProps, formatDuration, videoDurationInFrames } from "@/lib/video/props";
import { CopyStep } from "./CopyStep";
import { ExportStep } from "./ExportStep";
import { ProductStep } from "./ProductStep";
import { ScriptStep } from "./ScriptStep";
import { StyleStep } from "./StyleStep";
import { useProjectEditor, type SaveState } from "./useProjectEditor";

const PreviewPlayer = dynamic(() => import("./PreviewPlayer"), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-[20px] bg-surface-2" />,
});

const STEPS = [
  { id: "product", label: "상품·사진" },
  { id: "script", label: "훅·대본" },
  { id: "style", label: "스타일·음성" },
  { id: "copy", label: "업로드 문구" },
  { id: "export", label: "내보내기" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const ACTIVE_RENDER = new Set<Project["render"]["status"]>(["queued", "bundling", "rendering"]);
const POLL_MS = 1500;

const SAVE_LABELS: Record<SaveState, string> = { idle: "", saving: "저장 중…", saved: "저장됨", error: "저장 실패" };

function stepDone(step: StepId, p: Project): boolean {
  switch (step) {
    case "product":
      return Boolean(p.product.name && p.assets.length);
    case "script":
      return p.scenes.length > 0;
    case "style":
      return p.scenes.length > 0;
    case "copy":
      return Boolean(p.copy.caption);
    case "export":
      return p.render.status === "done";
  }
}

export function Editor({ id }: { id: string }) {
  const editor = useProjectEditor(id);
  const { project, loadError, saveState, syncRender } = editor;
  const [settings, setSettings] = useState<MaskedSettings | null>(null);
  const [step, setStep] = useState<StepId>("product");
  const [starting, setStarting] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    api<{ settings: MaskedSettings }>("/api/settings")
      .then(({ settings }) => setSettings(settings))
      .catch(() => setSettings(null));
  }, []);

  const renderStatus = project?.render.status;
  const renderActive = Boolean(renderStatus && ACTIVE_RENDER.has(renderStatus)) && !stale;

  useEffect(() => {
    if (!renderActive) return;
    const timer = setInterval(async () => {
      try {
        const res = await api<{ render: Project["render"]; active: boolean }>(`/api/projects/${id}/render`);
        const finished = res.render.status === "done" || res.render.status === "error";
        syncRender(res.render, finished ? (res.render.status as "done" | "error") : undefined);
        if (res.render.status === "done") toast.success("영상이 완성됐어요!");
        if (res.render.status === "error") toast.error("렌더링에 실패했어요. 내보내기 단계에서 원인을 확인하세요.");
        // The worker died without reporting (e.g. the PC slept); allow a fresh start.
        if (!res.active && !finished) setStale(true);
      } catch {
        // Transient network errors: keep polling.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [id, renderActive, syncRender]);

  const startRender = useCallback(async () => {
    setStarting(true);
    try {
      await editor.flush();
      const { render } = await api<{ render: Project["render"] }>(`/api/projects/${id}/render`, { method: "POST" });
      setStale(false);
      syncRender(render, "rendering");
      toast.info("렌더링을 시작했어요. 이 화면을 벗어나도 계속 진행돼요.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setStarting(false);
    }
  }, [editor, id, syncRender]);

  async function autoCreate() {
    if (!project) return;
    if (project.assets.length === 0 && !confirm("사진이 없으면 단색 배경 영상이 돼요. 계속할까요?")) return;
    if (project.scenes.length > 0 && !confirm("대본을 새로 만들고 바로 영상까지 만들어요. 직접 고친 대본은 바뀌어요. 계속할까요?")) {
      return;
    }
    setAutoRunning(true);
    try {
      const script = await editor.run(() =>
        api<{ project: Project; warning?: string }>(`/api/projects/${id}/script`, {
          method: "POST",
          json: { useAi: llmReady(settings), hookAngle: project.hookAngle },
        }),
      );
      if (script.warning) toast.error(script.warning);
      const { provider } = script.project.voice;
      if (provider !== "none" && ttsReady(settings, provider)) {
        try {
          await editor.run(() => api<{ project: Project }>(`/api/projects/${id}/voice`, { method: "POST" }));
        } catch (error) {
          toast.error(`나레이션 생성에 실패해 자막만으로 진행해요. (${errorMessage(error)})`);
        }
      }
      setStep("export");
      await startRender();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAutoRunning(false);
    }
  }

  const deferred = useDeferredValue(project);
  const videoProps = useMemo(
    () => (deferred ? buildVideoProps(deferred, (file) => projectFileUrl(id, file)) : null),
    [deferred, id],
  );

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="text-lg font-bold">{loadError}</p>
        <Link href="/" className="mt-4 inline-block text-accent underline-offset-2 hover:underline">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }
  if (!project || !videoProps) {
    return (
      <div className="flex justify-center py-32 text-muted">
        <Spinner className="size-6" />
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const stepProps = { project, editor, settings };
  const seconds = formatDuration(videoDurationInFrames(videoProps));

  return (
    <div className="mx-auto max-w-7xl px-5 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-muted hover:text-fg">
          ← 내 숏폼
        </Link>
        <input
          aria-label="프로젝트 제목"
          value={project.title}
          maxLength={80}
          onChange={(e) => editor.change("title", e.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-xl font-extrabold outline-none hover:bg-surface-2 focus:bg-surface-2"
        />
        <StatusBadge status={project.status} />
        <span className={cx("w-16 text-xs", saveState === "error" ? "text-danger" : "text-faint")}>{SAVE_LABELS[saveState]}</span>
        <Button variant="primary" onClick={autoCreate} loading={autoRunning} disabled={renderActive || starting}>
          ⚡ 원클릭 자동 생성
        </Button>
      </div>

      <nav className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={cx(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition",
              step === s.id ? "bg-surface-3 text-fg" : "text-muted hover:text-fg",
            )}
          >
            <span
              className={cx(
                "flex size-5 items-center justify-center rounded-full text-[11px]",
                stepDone(s.id, project) ? "bg-success text-black" : step === s.id ? "bg-accent text-white" : "bg-surface-3",
              )}
            >
              {stepDone(s.id, project) ? "✓" : i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {step === "product" ? <ProductStep {...stepProps} /> : null}
          {step === "script" ? <ScriptStep {...stepProps} /> : null}
          {step === "style" ? <StyleStep {...stepProps} /> : null}
          {step === "copy" ? <CopyStep {...stepProps} /> : null}
          {step === "export" ? (
            <ExportStep {...stepProps} renderer={{ start: startRender, starting, active: renderActive }} />
          ) : null}

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1].id)}>
              ← 이전
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button onClick={() => setStep(STEPS[stepIndex + 1].id)}>다음: {STEPS[stepIndex + 1].label} →</Button>
            ) : null}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-muted">
              <span className="font-semibold text-fg">실시간 미리보기</span>
              <span>
                {videoProps.scenes.length}장면 · {seconds}
              </span>
            </div>
            {videoProps.scenes.length ? (
              <div className="mx-auto max-w-[300px]">
                <PreviewPlayer props={videoProps} />
              </div>
            ) : (
              <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-[20px] bg-surface-2 p-6 text-center text-sm text-muted">
                <span className="text-3xl">🎬</span>
                대본을 만들면 여기서 영상을 바로 볼 수 있어요.
              </div>
            )}
            <p className="mt-3 text-xs text-faint">
              미리보기는 실제 렌더와 같은 템플릿이에요. 자막은 인스타 UI에 가리지 않는 안전 영역 안에 배치돼요.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
