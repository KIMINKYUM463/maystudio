"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Field, inputClass, SectionTitle, cx } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { HOOK_ANGLE_LABELS, REVIEW_HOOK_LIBRARY } from "@/lib/script/hooks";
import { SCENE_DURATIONS } from "@/lib/script/generator";
import { romanceSuggestions } from "@/lib/script/romance";
import { speechSeconds } from "@/lib/script/subtitles";
import { llmReady } from "@/lib/settings-view";
import {
  CAMERA_MOVES,
  HOOK_ANGLES,
  MAX_SCENE_SHOTS,
  type CameraMove,
  type Project,
  type Scene,
  type SceneKind,
} from "@/lib/types";
import { CAMERA_LABELS } from "@/remotion/camera";
import type { StepProps } from "./useProjectEditor";

const KIND_LABELS: Record<SceneKind, string> = {
  hook: "① 후킹 (0~3초)",
  feature: "② 소구점",
  romance: "③ 로망",
  outro: "④ 덤·여운",
  info: "가격·정보",
  cta: "⑤ 댓글 키워드",
};

/** The benchmark reel is one spoken story: hook → story → 덤 → closing, no CTA scene. */
const REVIEW_KIND_LABELS: Record<SceneKind, string> = {
  ...KIND_LABELS,
  hook: "① 첫 문장 (커버 훅)",
  feature: "② 이야기",
  romance: "③ 덤",
  outro: "④ 마무리",
};

/** Kit: short words that match the video's mood get more comments than generic ones. */
const KEYWORD_SUGGESTIONS = ["쉼", "여기", "정보", "온천", "한옥", "겨울", "숙소"];

export function ScriptStep({ project, editor, settings }: StepProps) {
  const aiReady = llmReady(settings);
  const [useAi, setUseAi] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { scenes, assets } = project;
  const isReview = project.style.template === "review";
  const kindLabels = isReview ? REVIEW_KIND_LABELS : KIND_LABELS;
  const staleForTemplate = isReview && scenes.some((s) => s.kind === "cta" || s.kind === "info");

  async function generate(variation: boolean) {
    if (scenes.length > 0 && !confirm("대본을 새로 만들면 직접 고친 자막·나레이션과 생성된 음성이 바뀌어요. 계속할까요?")) {
      return;
    }
    setGenerating(true);
    try {
      const result = await editor.run(() =>
        api<{ project: Project; source: "ai" | "template"; warning?: string }>(`/api/projects/${project.id}/script`, {
          method: "POST",
          json: {
            useAi: useAi && aiReady,
            hookAngle: project.hookAngle,
            seed: variation ? Math.floor(Math.random() * 1e9) : undefined,
          },
        }),
      );
      if (result.warning) toast.error(result.warning);
      else toast.success(result.source === "ai" ? "AI가 대본과 업로드 문구를 썼어요." : "대본과 업로드 문구를 만들었어요.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  const updateScene = (id: string, patch: Partial<Scene>) =>
    editor.change("scenes", (list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const setKeyword = (commentKeyword: string) => editor.change("copy", (c) => ({ ...c, commentKeyword }));

  /** Subtitle templates time the scene to the spoken line, so editing it re-times the scene. */
  const updateNarration = (id: string, narration: string) =>
    updateScene(id, isReview ? { narration, durationSec: speechSeconds(narration) } : { narration });

  const romanceScene = isReview ? undefined : scenes.find((s) => s.kind === "romance");
  const romances = romanceSuggestions(project.product);

  function moveScene(index: number, delta: -1 | 1) {
    editor.change("scenes", (list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addScene() {
    const scene: Scene = {
      id: `scene-${Date.now().toString(36)}`,
      kind: "feature",
      assetId: assets[0]?.id ?? null,
      extraAssetIds: [],
      caption: "새 장면 자막",
      subCaption: "",
      narration: "",
      camera: "push-in",
      durationSec: SCENE_DURATIONS.feature,
    };
    editor.change("scenes", (list) => {
      const ctaIndex = list.findIndex((s) => s.kind === "cta");
      return ctaIndex < 0 ? [...list, scene] : [...list.slice(0, ctaIndex), scene, ...list.slice(ctaIndex)];
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle
          title="훅 스타일"
          description="첫 문장이 조회수를 결정해요. 반응이 없으면 영상은 그대로 두고 훅만 바꿔 다시 올려보세요."
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HOOK_ANGLES.map((angle) => (
            <button
              key={angle}
              type="button"
              onClick={() => editor.change("hookAngle", angle)}
              className={cx(
                "rounded-xl border p-3 text-left transition",
                project.hookAngle === angle ? "border-accent bg-accent/10" : "border-line bg-surface-2 hover:border-faint",
              )}
            >
              <p className="text-sm font-bold">{HOOK_ANGLE_LABELS[angle].label}</p>
              <p className="mt-1 text-xs text-muted">{HOOK_ANGLE_LABELS[angle].description}</p>
              <p className="mt-1.5 text-xs text-faint">
                &ldquo;{isReview
                  ? (REVIEW_HOOK_LIBRARY[angle].at(-1)?.caption.replace(/\n/g, " ") ?? HOOK_ANGLE_LABELS[angle].example)
                  : HOOK_ANGLE_LABELS[angle].example}&rdquo;
              </p>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
          {isReview ? (
            <p className="text-xs text-muted">
              이 템플릿은 키워드 대신 <b className="text-fg">아무 댓글</b>이나 달면 DM이 가는 방식이에요. 영상 끝에 CTA 장면도 없어요.
            </p>
          ) : (
          <Field label="댓글 키워드" hint="짧고 영상 분위기에 맞는 말일수록 댓글이 많아요" htmlFor="keyword">
            <input
              id="keyword"
              className={inputClass}
              maxLength={10}
              value={project.copy.commentKeyword}
              onChange={(e) => setKeyword(e.target.value.trim())}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {KEYWORD_SUGGESTIONS.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => setKeyword(word)}
                  className={cx(
                    "rounded-full border px-2 py-0.5 text-xs transition",
                    project.copy.commentKeyword === word ? "border-accent text-accent" : "border-line text-muted hover:border-faint",
                  )}
                >
                  {word}
                </button>
              ))}
            </div>
          </Field>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => generate(false)} loading={generating}>
              {scenes.length ? "대본 다시 만들기" : "대본 자동 생성"}
            </Button>
            <Button onClick={() => generate(true)} disabled={generating}>
              다른 버전 보기
            </Button>
            <label className={cx("ml-1 flex items-center gap-2 text-sm", aiReady ? "text-muted" : "text-faint")}>
              <input type="checkbox" checked={useAi && aiReady} disabled={!aiReady} onChange={(e) => setUseAi(e.target.checked)} />
              AI로 다듬기
            </label>
            {!aiReady ? (
              <Link href="/settings" className="text-xs text-accent underline-offset-2 hover:underline">
                AI 키 설정하기
              </Link>
            ) : null}
          </div>
        </div>
        {staleForTemplate ? (
          <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            지금 대본은 다른 템플릿으로 만든 거예요. 후기형 구성(첫 문장 → 이야기 → 덤 → 마무리)으로 바꾸려면 대본을 다시
            만드세요.
          </p>
        ) : null}
      </Card>

      {romanceScene && romances.length > 0 ? (
        <Card>
          <SectionTitle
            title="로망 문장 고르기"
            description="특징 → 좋은 점 → 로망 순서로 생각해요. 보는 사람이 그 자리에 있는 장면을 떠올리게 하는 한 줄이면 충분해요."
          />
          <ul className="grid gap-2 md:grid-cols-2">
            {romances.map((r) => {
              const active = romanceScene.caption === r.caption;
              return (
                <li key={r.feature}>
                  <button
                    type="button"
                    onClick={() => updateScene(romanceScene.id, { caption: r.caption, narration: r.narration })}
                    className={cx(
                      "w-full rounded-xl border p-3 text-left transition",
                      active ? "border-accent bg-accent/10" : "border-line bg-surface-2 hover:border-faint",
                    )}
                  >
                    <p className="text-xs text-faint">
                      {r.feature} → {r.benefit}
                    </p>
                    <p className="mt-1 text-sm font-bold whitespace-pre-line">{r.caption}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {scenes.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted">
          아직 대본이 없어요. 상품 정보와 사진을 넣고 <b className="text-fg">대본 자동 생성</b>을 눌러보세요.
        </Card>
      ) : (
        <Card>
          <SectionTitle
            title={`장면 ${scenes.length}개`}
            description={
              isReview
                ? "영상에는 나레이션이 말하는 속도에 맞춰 몇 글자씩 끊겨 나와요. 커버·캐러셀 문구는 사진 위에 올라가는 글이에요."
                : "자막은 줄바꿈(Enter)으로 두 줄까지 쓰는 게 좋아요. 나레이션을 고치면 그 장면의 음성은 다시 만들어야 해요."
            }
            action={
              <Button size="sm" onClick={addScene} disabled={scenes.length >= 16}>
                + 장면 추가
              </Button>
            }
          />
          <ol className="flex flex-col gap-3">
            {scenes.map((scene, i) => (
              <li key={scene.id} className="rounded-xl border border-line bg-surface-2 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-bold text-faint">#{i + 1}</span>
                  <Badge tone={scene.kind === "hook" ? "accent" : scene.kind === "cta" ? "success" : "neutral"}>
                    {kindLabels[scene.kind]}
                  </Badge>
                  {scene.audioFile ? <Badge tone="success">🔊 {scene.audioDurationSec?.toFixed(1)}초</Badge> : null}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => moveScene(i, -1)} disabled={i === 0} aria-label="위로">
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveScene(i, 1)}
                      disabled={i === scenes.length - 1}
                      aria-label="아래로"
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      disabled={scenes.length <= 1}
                      onClick={() => editor.change("scenes", (list) => list.filter((s) => s.id !== scene.id))}
                    >
                      삭제
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[96px_1fr]">
                  <AssetPicker
                    projectId={project.id}
                    assets={assets}
                    value={scene.assetId}
                    extras={scene.extraAssetIds}
                    onChange={(assetId) => updateScene(scene.id, { assetId })}
                    onExtrasChange={(extraAssetIds) => updateScene(scene.id, { extraAssetIds })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={isReview ? "커버·캐러셀 문구" : "자막"} className="sm:col-span-2">
                      <textarea
                        rows={2}
                        maxLength={60}
                        className={cx(inputClass, "text-base font-bold")}
                        value={scene.caption}
                        onChange={(e) => updateScene(scene.id, { caption: e.target.value })}
                      />
                    </Field>
                    {isReview ? null : (
                      <Field label="보조 자막">
                        <input
                          maxLength={60}
                          className={inputClass}
                          value={scene.subCaption}
                          onChange={(e) => updateScene(scene.id, { subCaption: e.target.value })}
                        />
                      </Field>
                    )}
                    <div className={cx("grid grid-cols-2 gap-3", isReview && "sm:col-span-2")}>
                      <Field label="카메라">
                        <select
                          className={inputClass}
                          value={scene.camera}
                          onChange={(e) => updateScene(scene.id, { camera: e.target.value as CameraMove })}
                        >
                          {CAMERA_MOVES.map((m) => (
                            <option key={m} value={m}>
                              {CAMERA_LABELS[m]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="길이(초)">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          step={0.1}
                          className={inputClass}
                          value={scene.durationSec}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (value >= 1 && value <= 10) updateScene(scene.id, { durationSec: value });
                          }}
                        />
                      </Field>
                    </div>
                    <Field label={isReview ? "나레이션 (영상 자막)" : "나레이션"} className="sm:col-span-2">
                      <textarea
                        rows={2}
                        maxLength={200}
                        className={inputClass}
                        value={scene.narration}
                        onChange={(e) => updateNarration(scene.id, e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function AssetPicker({
  projectId,
  assets,
  value,
  extras,
  onChange,
  onExtrasChange,
}: {
  projectId: string;
  assets: Project["assets"];
  value: string | null;
  extras: string[];
  onChange: (assetId: string | null) => void;
  onExtrasChange: (extraAssetIds: string[]) => void;
}) {
  const current = assets.find((a) => a.id === value);
  const used = new Set([value, ...extras]);
  const addable = assets.filter((a) => !used.has(a.id));
  const canAdd = value !== null && extras.length < MAX_SCENE_SHOTS - 1 && addable.length > 0;
  return (
    <div className="flex flex-row flex-wrap gap-2 md:flex-col">
      <div className="relative aspect-[9/16] w-24 overflow-hidden rounded-lg bg-surface-3">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- user media served by our own API
          <img src={projectFileUrl(projectId, current.file)} alt={current.label} className="size-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-faint">사진 없음</span>
        )}
        {current?.videoFile ? (
          <span className="absolute top-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">🎬</span>
        ) : null}
        {extras.length ? (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">
            +{extras.length}컷
          </span>
        ) : null}
      </div>
      <select
        aria-label="장면 사진"
        className={cx(inputClass, "w-24 px-2 py-1 text-xs")}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">사진 없음</option>
        {assets.map((a, i) => (
          <option key={a.id} value={a.id}>
            {i + 1}. {a.label || "사진"}
          </option>
        ))}
      </select>
      {extras.length ? (
        <ul className="flex w-24 flex-wrap gap-1" aria-label="이어지는 컷">
          {extras.map((id) => {
            const asset = assets.find((a) => a.id === id);
            if (!asset) return null;
            return (
              <li key={id} className="relative size-[44px] overflow-hidden rounded bg-surface-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- user media served by our own API */}
                <img src={projectFileUrl(projectId, asset.file)} alt={asset.label} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label="컷 빼기"
                  onClick={() => onExtrasChange(extras.filter((x) => x !== id))}
                  className="absolute top-0 right-0 bg-black/70 px-1 text-[10px] leading-4 text-white"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {canAdd ? (
        <select
          aria-label="컷 추가"
          className={cx(inputClass, "w-24 px-2 py-1 text-xs")}
          value=""
          onChange={(e) => e.target.value && onExtrasChange([...extras, e.target.value])}
        >
          <option value="">+ 컷 추가</option>
          {addable.map((a) => (
            <option key={a.id} value={a.id}>
              {assets.indexOf(a) + 1}. {a.label || "사진"}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
