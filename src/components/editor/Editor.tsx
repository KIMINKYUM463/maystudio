"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SETTINGS_SAVED_EVENT } from "@/components/settings/SettingsDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/components/toast";
import { Button, Spinner, cx } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { animateTargets, isGenericLabel } from "@/lib/photo-groups";
import { llmReady, replicateReady, ttsReady, visionReady, type MaskedSettings } from "@/lib/settings-view";
import type { Project } from "@/lib/types";
import { buildVideoProps, formatDuration, videoDurationInFrames } from "@/lib/video/props";
import { ProductStep } from "./ProductStep";
import { StayPicker } from "./StayPicker";
import { ScriptStep } from "./ScriptStep";
import { animatePath, waitForAnimate, type AnimateResult } from "./AssetVideoClip";
import { AutoCreatePanel, type AutoStage } from "./AutoCreatePanel";
import { StyleStep } from "./StyleStep";
import { useProjectEditor, type SaveState } from "./useProjectEditor";
import { VideoEditorDialog } from "./VideoEditorDialog";

const PreviewPlayer = dynamic(() => import("./PreviewPlayer"), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-[20px] bg-surface-2" />,
});

const STEPS = [
  // Step 0: pick a trending stay; the AI fills photos and facts for the product step.
  { id: "stay", label: "숙소 고르기" },
  { id: "product", label: "상품·사진" },
  { id: "script", label: "훅·대본" },
  { id: "style", label: "스타일·음성" },
  // Copy and export live inside the video-editor popup (opened from this step).
  { id: "edit", label: "영상 편집" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const ACTIVE_RENDER = new Set<Project["render"]["status"]>(["queued", "bundling", "rendering"]);
const POLL_MS = 1500;

const SAVE_LABELS: Record<SaveState, string> = { idle: "", saving: "저장 중…", saved: "저장됨", error: "저장 실패" };

function stepDone(step: StepId, p: Project): boolean {
  switch (step) {
    case "stay":
    case "product":
      return Boolean(p.product.name && p.assets.length);
    case "script":
      return p.scenes.length > 0;
    case "style":
      return p.scenes.length > 0;
    case "edit":
      return p.render.status === "done";
  }
}

export function Editor({ id }: { id: string }) {
  const editor = useProjectEditor(id);
  const { project, loadError, saveState, syncRender } = editor;
  const [settings, setSettings] = useState<MaskedSettings | null>(null);
  const [chosenStep, setStep] = useState<StepId | null>(null);
  // Until the user picks a step: empty projects open on 숙소 고르기, filled ones on 상품·사진.
  const step: StepId = chosenStep ?? (project && project.assets.length === 0 && !project.product.name ? "stay" : "product");
  const stepsRef = useRef<HTMLElement>(null);

  /** Switch step and bring the stepper back into view when the user had scrolled past it (e.g. "다음" at the page bottom). */
  function goTo(next: StepId) {
    if (next === "edit" && project?.scenes.length) setEditorOpen(true);
    setStep(next);
    const nav = stepsRef.current;
    if (nav && nav.getBoundingClientRect().top < 64) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      nav.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    }
  }
  const [starting, setStarting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  /** Script and voice done → the video-editor step (popup). */
  function openEditor() {
    setStep("edit");
    setEditorOpen(true);
  }
  const [autoRunning, setAutoRunning] = useState(false);
  /** One-click progress panel: the stage the pipeline is in, plus stages it skipped. */
  const [autoStage, setAutoStage] = useState<AutoStage | null>(null);
  const [autoSkipped, setAutoSkipped] = useState<Set<AutoStage>>(new Set());
  const [stale, setStale] = useState(false);

  useEffect(() => {
    api<{ settings: MaskedSettings }>("/api/settings")
      .then(({ settings }) => setSettings(settings))
      .catch(() => setSettings(null));
    const onSaved = (e: Event) => setSettings((e as CustomEvent<MaskedSettings>).detail);
    window.addEventListener(SETTINGS_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(SETTINGS_SAVED_EVENT, onSaved);
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
    const skip = (stage: AutoStage) => setAutoSkipped((prev) => new Set(prev).add(stage));
    setAutoSkipped(new Set());
    setAutoStage("classify");
    try {
      // Unlabelled import photos: let AI sort them first so the best water shot opens the reel.
      const classify = project.assets.length > 1 && project.assets.every((a) => isGenericLabel(a.label)) && visionReady(settings);
      if (!classify) skip("classify");
      let assets = project.assets;
      if (classify) {
        try {
          ({ assets } = (await editor.run(() => api<{ project: Project }>(`/api/projects/${id}/assets/classify`, { method: "POST" }))).project);
        } catch (error) {
          toast.error(`사진 분류는 건너뛰고 진행해요. (${errorMessage(error)})`);
        }
      }
      // Runbi-style: water/signature photos become short AI clips before the script is written (opt-in, billed).
      setAutoStage("animate");
      const targets = project.style.animatePhotos && replicateReady(settings) ? animateTargets(assets) : [];
      if (!targets.length) skip("animate");
      for (const asset of targets) {
        try {
          await editor.run(() => api<AnimateResult>(animatePath(id, asset.id), { method: "POST", json: {} }));
          await waitForAnimate(editor, id, asset.id);
        } catch (error) {
          toast.error(`${asset.label || "사진"} AI 영상은 건너뛰어요. (${errorMessage(error)})`);
        }
      }
      setAutoStage("script");
      const script = await editor.run(() =>
        api<{ project: Project; warning?: string }>(`/api/projects/${id}/script`, {
          method: "POST",
          json: { useAi: llmReady(settings), hookAngle: project.hookAngle },
        }),
      );
      if (script.warning) toast.error(script.warning);
      const { provider } = script.project.voice;
      setAutoStage("voice");
      if (provider === "none" || !ttsReady(settings, provider)) skip("voice");
      if (provider !== "none" && ttsReady(settings, provider)) {
        try {
          await editor.run(() => api<{ project: Project }>(`/api/projects/${id}/voice`, { method: "POST" }));
        } catch (error) {
          toast.error(`나레이션 생성에 실패해 자막만으로 진행해요. (${errorMessage(error)})`);
        }
      }
      openEditor();
      setAutoStage("render");
      await startRender();
    } catch (error) {
      setAutoStage("error");
      toast.error(errorMessage(error));
    } finally {
      setAutoRunning(false);
    }
  }

  // The render outcome arrives by polling; derive the panel's final stage from it instead of syncing state.
  const shownStage: AutoStage | null =
    autoStage === "render" && renderStatus === "done"
      ? "done"
      : autoStage === "render" && renderStatus === "error"
        ? "error"
        : autoStage;

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
  const renderer = { start: startRender, starting, active: renderActive };
  const stepProps = { project, editor, settings, openEditor: () => openEditor() };
  const seconds = formatDuration(videoDurationInFrames(videoProps));

  return (
    <div className="mx-auto max-w-7xl px-5 py-6">
      <VideoEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        videoProps={videoProps}
        renderer={renderer}
        {...stepProps}
      />
      {shownStage ? (
        <AutoCreatePanel
          stage={shownStage}
          progress={project.render.progress}
          skipped={autoSkipped}
          hookLine={project.scenes[0]?.narration ?? ""}
          onClose={() => setAutoStage(null)}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="rounded-lg px-1 py-1 text-sm font-medium text-muted hover:text-fg">
          ← 내 숏폼
        </Link>
        <input
          aria-label="프로젝트 제목"
          value={project.title}
          maxLength={80}
          onChange={(e) => editor.change("title", e.target.value)}
          className="min-w-0 flex-1 basis-full rounded-lg bg-transparent sm:basis-0 px-2 py-1 text-2xl font-black tracking-tight outline-none hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-accent/25"
        />
        <StatusBadge status={project.status} />
        <span className={cx("w-16 text-xs", saveState === "error" ? "text-danger" : "text-faint")}>{SAVE_LABELS[saveState]}</span>
        <Button size="lg" onClick={() => openEditor()} disabled={project.scenes.length === 0}>
          영상 편집
        </Button>
        <Button size="lg" variant="primary" onClick={autoCreate} loading={autoRunning} disabled={renderActive || starting}>
          {autoRunning ? null : <BoltIcon />}
          원클릭 자동 생성
        </Button>
      </div>

      <nav ref={stepsRef} aria-label="만드는 단계" className="mt-6 scroll-mt-20 rounded-2xl border border-line bg-surface px-2 pt-4 pb-3 shadow-[var(--shadow-card)]">
        <ol className="relative grid grid-cols-5">
          {/* Route line between the first and last stop; the coral part shows how far along we are. */}
          <span aria-hidden className="absolute top-[18px] right-[10%] left-[10%] h-0.5 bg-line" />
          <span
            aria-hidden
            className="absolute top-[18px] left-[10%] h-0.5 bg-accent transition-[width] duration-500"
            style={{ width: `${(stepIndex / (STEPS.length - 1)) * 80}%` }}
          />
          {STEPS.map((s, i) => {
            const done = stepDone(s.id, project);
            const active = step === s.id;
            return (
              <li key={s.id} className="relative">
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  aria-current={active ? "step" : undefined}
                  className="group flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <span
                    className={cx(
                      "flex size-9 items-center justify-center rounded-full border-2 text-sm font-black transition",
                      active
                        ? "border-accent bg-accent text-white shadow-[0_6px_14px_-6px_var(--color-accent)]"
                        : done
                          ? "border-success bg-success text-white"
                          : "border-line bg-surface text-muted group-hover:border-faint",
                    )}
                  >
                    {done && !active ? <CheckIcon /> : i + 1}
                  </span>
                  <span
                    className={cx(
                      "text-center text-xs font-semibold sm:text-sm",
                      active ? "text-fg" : "text-muted group-hover:text-fg",
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={cx("mt-5 grid gap-6", step !== "stay" && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        <div className="min-w-0">
          {step === "stay" ? <StayPicker projectId={project.id} editor={editor} onDone={() => goTo("product")} /> : null}
          {step === "product" ? <ProductStep {...stepProps} /> : null}
          {step === "script" ? <ScriptStep {...stepProps} /> : null}
          {step === "style" ? <StyleStep {...stepProps} /> : null}
          {step === "edit" ? (
            <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
              <p className="font-display text-2xl font-extrabold tracking-[-0.02em]">영상 편집</p>
              <p className="mt-2 text-sm text-muted">장면·자막 수정, 썸네일, 업로드 문구, 내보내기를 편집기에서 한 번에 해요.</p>
              <Button size="lg" variant="primary" className="mt-5" onClick={() => setEditorOpen(true)} disabled={project.scenes.length === 0}>
                편집기 열기
              </Button>
              {project.scenes.length === 0 ? <p className="mt-3 text-xs text-faint">먼저 대본을 만들어 주세요.</p> : null}
            </div>
          ) : null}

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" disabled={stepIndex === 0} onClick={() => goTo(STEPS[stepIndex - 1].id)}>
              ← 이전
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => goTo(STEPS[stepIndex + 1].id)}>다음: {STEPS[stepIndex + 1].label} →</Button>
            ) : null}
          </div>
        </div>

        {/* The stay lookbook gets the full width; there is nothing to preview yet. */}
        <aside className={cx("lg:sticky lg:top-20 lg:self-start", step === "stay" && "hidden")}>
          <div className="mx-auto flex max-w-[320px] items-baseline justify-between px-1">
            <span className="text-sm font-bold text-fg">실시간 미리보기</span>
            <span className="tabular text-xs font-semibold text-muted">
              {videoProps.scenes.length}장면 · {seconds}
            </span>
          </div>
          <PhoneFrame>
            {videoProps.scenes.length ? (
              <PreviewPlayer props={videoProps} />
            ) : (
              <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 bg-surface-2 p-8 text-center text-sm text-muted">
                <FilmIcon />
                대본을 만들면 여기서 영상을 바로 볼 수 있어요.
              </div>
            )}
          </PhoneFrame>
          <p className="mx-auto mt-4 max-w-[320px] px-1 text-xs leading-relaxed text-faint">
            미리보기는 실제 렌더와 같은 템플릿이에요. 자막은 인스타 UI에 가리지 않는 안전 영역 안에 배치돼요.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Phone bezel around the live preview so it reads as the reel your followers will see. */
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto mt-3 w-full max-w-[320px] rounded-[2.75rem] bg-[#111827] p-[10px] shadow-[0_28px_50px_-24px_rgba(30,58,138,0.45),inset_0_0_0_1.5px_rgba(255,255,255,0.08)]">
      {/* Side buttons */}
      <span aria-hidden className="absolute top-28 -left-[3px] h-10 w-[3px] rounded-l bg-[#1f2937]" />
      <span aria-hidden className="absolute top-40 -left-[3px] h-14 w-[3px] rounded-l bg-[#1f2937]" />
      <span aria-hidden className="absolute top-32 -right-[3px] h-16 w-[3px] rounded-r bg-[#1f2937]" />
      <div className="relative overflow-hidden rounded-[2.2rem] bg-black">
        <span aria-hidden className="pointer-events-none absolute top-2.5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        {children}
      </div>
    </div>
  );
}

const ICON = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function BoltIcon() {
  return (
    <svg {...ICON}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...ICON} width={16} height={16} strokeWidth={3}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg {...ICON} width={32} height={32} strokeWidth={1.8} className="text-faint">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" />
    </svg>
  );
}
