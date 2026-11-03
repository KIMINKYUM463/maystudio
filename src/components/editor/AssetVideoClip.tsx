"use client";

import { useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { toast } from "@/components/toast";
import { Badge, Button, inputClass, cx } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { buildVideoPrompt, detectPromptType, labelHasPeople, PROMPT_TYPES, type PromptTypeId } from "@/lib/script/video-prompts";
import type { Asset, Project } from "@/lib/types";
import type { StepProps } from "./useProjectEditor";

export const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";
export const ANIMATE_POLL_MS = 2500;

export type AnimateResult = { project: Project; status: "starting" | "processing" | "succeeded" | "failed"; error?: string };

export function animatePath(projectId: string, assetId: string): string {
  return `/api/projects/${projectId}/assets/${encodeURIComponent(assetId)}/animate`;
}

/** POST then poll until the mp4 is attached (or Replicate reports failure). */
export async function waitForAnimate(editor: StepProps["editor"], projectId: string, assetId: string): Promise<AnimateResult> {
  while (true) {
    const result = await editor.run(() => api<AnimateResult>(animatePath(projectId, assetId)));
    if (result.status === "succeeded") return result;
    if (result.status === "failed") throw new Error(result.error || "Replicate 영상 생성이 실패했어요.");
    await new Promise((resolve) => setTimeout(resolve, ANIMATE_POLL_MS));
  }
}

/**
 * Background footage only: Replicate (or a Flow upload) becomes the cut's mp4.
 * Motion graphics (captions, logo, transitions) are composed on top in Remotion —
 * making a clip never removes those layers.
 */
export function AssetVideoClip({
  projectId,
  asset,
  editor,
  canReplicate,
  locked = false,
}: {
  projectId: string;
  asset: Asset;
  editor: StepProps["editor"];
  canReplicate: boolean;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(asset.animateJobId));
  const [type, setType] = useState<PromptTypeId | null>(null);
  const [withPeople, setWithPeople] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const polling = useRef(false);

  const promptType = type ?? detectPromptType(asset.label);
  const people = withPeople ?? labelHasPeople(asset.label);
  const clipUrl = `/api/projects/${projectId}/assets/${encodeURIComponent(asset.id)}/clip`;
  const working = busy || Boolean(asset.animateJobId) || locked;

  useEffect(() => {
    if (!asset.animateJobId || polling.current || locked) return;
    let cancelled = false;
    polling.current = true;
    setBusy(true);
    void waitForAnimate(editor, projectId, asset.id)
      .then(() => {
        if (!cancelled) toast.success("Replicate 영상을 붙였어요. 이 사진 자리에서 재생돼요.");
      })
      .catch((error) => {
        if (!cancelled) toast.error(errorMessage(error));
      })
      .finally(() => {
        polling.current = false;
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      polling.current = false;
    };
  }, [asset.animateJobId, asset.id, editor, locked, projectId]);

  async function send(init: { method: "POST" | "DELETE"; body?: FormData }, success: string) {
    setBusy(true);
    try {
      await editor.run(() => api<{ project: Project }>(clipUrl, init));
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function upload(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    void send({ method: "POST", body: form }, "AI 영상 클립을 넣었어요. 이 사진 자리에서 영상이 재생돼요.");
  }

  async function startReplicate() {
    setBusy(true);
    setOpen(true);
    try {
      await editor.run(() =>
        api<AnimateResult>(animatePath(projectId, asset.id), {
          method: "POST",
          json: { promptType, withPeople: people },
        }),
      );
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {asset.videoFile ? <Badge tone="success">🎬 영상</Badge> : null}
        {asset.animateJobId ? <Badge>만드는 중</Badge> : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-xs text-accent underline-offset-2 hover:underline"
          aria-expanded={open}
        >
          {open ? "닫기" : asset.videoFile ? "AI 영상 관리" : "AI 영상으로 만들기"}
        </button>
      </div>
      {open ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-3 p-2">
          <select
            aria-label="사진 종류"
            className={cx(inputClass, "py-1 text-xs")}
            value={promptType}
            disabled={working}
            onChange={(e) => setType(e.target.value as PromptTypeId)}
          >
            {PROMPT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={people} disabled={working} onChange={(e) => setWithPeople(e.target.checked)} />
            사진에 사람이 있어요
          </label>
          {canReplicate ? (
            <Button size="sm" variant="primary" onClick={() => void startReplicate()} loading={busy || Boolean(asset.animateJobId)} disabled={locked}>
              {asset.videoFile ? "Replicate로 다시 만들기" : "Replicate로 만들기"}
            </Button>
          ) : (
            <p className="text-[11px] text-faint">
              설정에 Replicate 토큰을 넣으면 여기서 바로 영상을 만들어요. 지금은 Flow에서 만든 mp4를 올릴 수 있어요.
            </p>
          )}
          <CopyButton text={buildVideoPrompt(promptType, people)} label="프롬프트 복사" />
          <input
            ref={fileInput}
            type="file"
            accept={VIDEO_ACCEPT}
            hidden
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <div className="flex gap-1">
            <Button size="sm" onClick={() => fileInput.current?.click()} loading={busy} disabled={locked || Boolean(asset.animateJobId)}>
              {asset.videoFile ? "클립 교체" : "클립 올리기"}
            </Button>
            {asset.videoFile ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                disabled={working}
                onClick={() => void send({ method: "DELETE" }, "클립을 뺐어요. 다시 사진으로 나와요.")}
              >
                빼기
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
