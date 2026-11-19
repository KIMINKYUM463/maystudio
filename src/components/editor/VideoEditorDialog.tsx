"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/toast";
import { buttonClass, cx, Spinner } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { speechSeconds } from "@/lib/script/subtitles";
import type { Project, Scene } from "@/lib/types";
import { FPS, transitionFramesFor, type VideoProps } from "@/lib/video/props";
import { CopyStep } from "./CopyStep";
import type { EditorPlayerHandle } from "./EditorPlayer";
import { ExportStep, type RenderStarter } from "./ExportStep";
import { Timeline } from "./Timeline";
import type { StepProps } from "./useProjectEditor";

const EditorPlayer = dynamic(() => import("./EditorPlayer"), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse bg-surface-2" />,
});

const TABS = [
  { id: "scenes", label: "장면" },
  { id: "cover", label: "썸네일" },
  { id: "copy", label: "업로드 문구" },
  { id: "export", label: "내보내기" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        ok ? "bg-success/10 text-success" : "bg-surface-3 text-muted",
      )}
    >
      {ok ? "✓" : "·"} {label}
    </span>
  );
}

/**
 * Full-screen video editor that opens once script and voice exist: phone preview with a playhead,
 * per-scene editing, cover, upload copy and export in tabs, and a 자막/영상/소리 timeline.
 */
export function VideoEditorDialog({
  open,
  onClose,
  videoProps,
  renderer,
  ...stepProps
}: StepProps & { open: boolean; onClose: () => void; videoProps: VideoProps; renderer: RenderStarter }) {
  const { project, editor } = stepProps;
  const ref = useRef<HTMLDialogElement>(null);
  const player = useRef<EditorPlayerHandle>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tab, setTab] = useState<TabId>("scenes");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voicing, setVoicing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Scene start frames on the real timeline (hard cuts or overlapping transitions).
  const starts = useMemo(() => {
    const overlap = transitionFramesFor(videoProps.style.template);
    const list: { id: string; from: number; to: number }[] = [];
    for (let i = 0, from = 0; i < videoProps.scenes.length; i++) {
      const s = videoProps.scenes[i];
      list.push({ id: s.id, from, to: from + s.durationInFrames });
      from += s.durationInFrames - (i < videoProps.scenes.length - 1 ? overlap : 0);
    }
    return list;
  }, [videoProps]);
  const activeScene = starts.find((s) => frame >= s.from && frame < s.to)?.id ?? null;

  const onFrame = useCallback((f: number) => setFrame(f), []);
  const onPlaying = useCallback((p: boolean) => setPlaying(p), []);

  function seek(f: number) {
    player.current?.seekTo(f);
    setFrame(f);
  }

  function updateScene(id: string, patch: Partial<Scene>) {
    editor.change("scenes", (list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function playVoice(scene: Scene) {
    if (!scene.audioFile) return;
    audio.current?.pause();
    audio.current = new Audio(projectFileUrl(project.id, scene.audioFile));
    void audio.current.play();
  }

  async function regenerateVoice() {
    setVoicing(true);
    try {
      await editor.run(() => api<{ project: Project }>(`/api/projects/${project.id}/voice`, { method: "POST" }));
      toast.success("바뀐 대본으로 목소리를 다시 만들었어요.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setVoicing(false);
    }
  }

  const scenes = project.scenes;
  const voiceOn = project.voice.provider !== "none";
  const voiced = voiceOn && scenes.length > 0 && scenes.every((s) => !s.narration.trim() || s.audioFile);
  const render = project.render;
  const assetSrc = (id: string | null) => {
    const asset = id ? project.assets.find((a) => a.id === id) : undefined;
    return asset ? projectFileUrl(project.id, asset.file) : null;
  };
  const seconds = (f: number) => (f / FPS).toFixed(1);

  return (
    <dialog
      ref={ref}
      aria-labelledby="video-editor-title"
      onClose={() => {
        audio.current?.pause();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-bg p-0 text-fg backdrop:bg-slate-900/40"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface/90 px-5 py-3 backdrop-blur">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-white shadow-[0_6px_16px_-6px_var(--color-accent)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m12 3 1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-accent">AI 자동편집</p>
            <h2 id="video-editor-title" className="truncate text-base font-bold">
              {project.title}
            </h2>
          </div>
          <div className="ml-auto hidden items-center gap-1.5 md:flex">
            <Check ok={scenes.length > 0} label="대본" />
            <Check ok={voiced} label="음성" />
            <Check ok={render.status === "done"} label={renderer.active ? `렌더링 ${Math.round(render.progress * 100)}%` : "렌더링"} />
          </div>
          {render.status === "done" && render.outputFile ? (
            <a
              href={`${projectFileUrl(project.id, render.outputFile)}?download=${encodeURIComponent(`${project.title}.mp4`)}`}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              mp4 내려받기
            </a>
          ) : null}
          <button type="button" onClick={() => ref.current?.close()} className={buttonClass({ variant: "ghost", size: "sm" })}>
            ✕ 닫기
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto grid max-w-[1400px] gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* Player */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
              <div className="relative mx-auto w-full max-w-[320px] rounded-[2.75rem] bg-[#111827] p-[10px] shadow-[0_28px_50px_-24px_rgba(30,58,138,0.45)]">
                <div className="relative overflow-hidden rounded-[2.2rem] bg-black">
                  <span aria-hidden className="pointer-events-none absolute top-2.5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
                  {scenes.length ? (
                    <EditorPlayer ref={player} props={videoProps} onFrame={onFrame} onPlaying={onPlaying} />
                  ) : (
                    <div className="flex aspect-[9/16] items-center justify-center p-8 text-center text-sm text-white/70">대본을 먼저 만들어 주세요.</div>
                  )}
                </div>
              </div>
              <div className="mx-auto flex w-full max-w-[320px] items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2">
                <button type="button" aria-label="처음으로" onClick={() => seek(0)} className="text-muted hover:text-fg">
                  ⏮
                </button>
                <button
                  type="button"
                  aria-label={playing ? "일시정지" : "재생"}
                  onClick={() => player.current?.toggle()}
                  className="flex size-9 items-center justify-center rounded-full bg-accent text-white"
                >
                  {playing ? "❚❚" : "▶"}
                </button>
                <span className="tabular text-xs text-muted">
                  {seconds(frame)}초 / {seconds(starts.at(-1)?.to ?? 0)}초
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="min-w-0 rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
              <nav className="flex gap-1 border-b border-line px-3 pt-3" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cx(
                      "rounded-t-xl px-4 py-2 text-sm font-semibold transition",
                      tab === t.id ? "bg-fg text-white" : "text-muted hover:text-fg",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>

              <div className="max-h-[56dvh] overflow-y-auto p-4">
                {tab === "scenes" ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted">장면을 누르면 그 위치로 이동해요. 대본을 고친 뒤에는 목소리를 다시 만들어 주세요.</p>
                      {voiceOn ? (
                        <button
                          type="button"
                          onClick={() => void regenerateVoice()}
                          disabled={voicing}
                          className={buttonClass({ variant: "secondary", size: "sm" })}
                        >
                          {voicing ? <Spinner className="size-3" /> : null}
                          목소리 다시 만들기
                        </button>
                      ) : null}
                    </div>
                    {scenes.map((scene, i) => {
                      const range = starts[i];
                      const thumb = assetSrc(scene.assetId);
                      return (
                        <div
                          key={scene.id}
                          className={cx(
                            "grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-2xl border p-3 transition",
                            activeScene === scene.id ? "border-accent bg-accent/[0.04] ring-2 ring-accent/15" : "border-line",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => range && seek(range.from)}
                            className="aspect-[9/16] overflow-hidden rounded-lg bg-surface-3 bg-cover bg-center"
                            style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                            aria-label={`${i + 1}번 장면으로 이동`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="flex size-5 items-center justify-center rounded-full bg-fg text-[11px] font-bold text-white">{i + 1}</span>
                              <span className="tabular font-semibold text-muted">
                                {range ? `${seconds(range.from)}~${seconds(range.to)}초` : ""} · 컷 {1 + scene.extraAssetIds.length}개
                              </span>
                              {scene.audioFile ? (
                                <button type="button" onClick={() => playVoice(scene)} className="ml-auto rounded-full border border-line px-2 py-0.5 font-semibold text-fg hover:border-accent">
                                  ▶ 목소리 듣기
                                </button>
                              ) : null}
                            </div>
                            <textarea
                              aria-label={`${i + 1}번 장면 나레이션`}
                              value={scene.narration}
                              rows={2}
                              maxLength={200}
                              onChange={(e) =>
                                updateScene(scene.id, {
                                  narration: e.target.value,
                                  durationSec: project.style.template === "review" ? speechSeconds(e.target.value) : scene.durationSec,
                                })
                              }
                              className="mt-2 w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {tab === "cover" ? (
                  <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-surface-3">
                      {render.thumbnailFile ? (
                        // eslint-disable-next-line @next/next/no-img-element -- rendered output served by our own API
                        <img src={projectFileUrl(project.id, render.thumbnailFile, render.finishedAt)} alt="릴스 커버" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center p-4 text-center text-xs text-muted">영상을 만들면 커버가 여기 나와요.</div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold">커버 문구</p>
                      <p className="mt-1 text-xs text-muted">2줄, 숫자·가격이 앞에 오면 프로필 격자에서 잘 보여요. 바꾼 뒤 다시 렌더링하면 커버에 반영돼요.</p>
                      {scenes[0] ? (
                        <textarea
                          aria-label="커버 문구"
                          value={scenes[0].caption}
                          rows={2}
                          maxLength={60}
                          onChange={(e) => updateScene(scenes[0].id, { caption: e.target.value })}
                          className="mt-3 w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 font-display text-lg leading-snug font-extrabold outline-none focus:border-accent"
                        />
                      ) : null}
                      {render.carouselFiles.length ? (
                        <>
                          <p className="mt-5 text-sm font-bold">캐러셀 {render.carouselFiles.length}장</p>
                          <div className="mt-2 flex gap-2 overflow-x-auto">
                            {render.carouselFiles.map((f) => (
                              // eslint-disable-next-line @next/next/no-img-element -- rendered output served by our own API
                              <img key={f} src={projectFileUrl(project.id, f, render.finishedAt)} alt="" className="h-28 rounded-lg" />
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {tab === "copy" ? <CopyStep {...stepProps} /> : null}
                {tab === "export" ? <ExportStep {...stepProps} renderer={renderer} /> : null}
              </div>
            </div>
          </div>

          {scenes.length ? (
            <div className="mx-auto mt-5 max-w-[1400px]">
              <Timeline props={videoProps} currentFrame={frame} onSeek={seek} activeScene={activeScene} />
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
