"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Field, inputClass, SectionTitle, cx } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { ttsReady } from "@/lib/settings-view";
import {
  CAPTION_POSITIONS,
  ELEVENLABS_DEFAULT_VOICE,
  OPENAI_VOICES,
  TEMPLATE_IDS,
  TTS_PROVIDERS,
  type Project,
  type Style,
  type Voice,
} from "@/lib/types";
import { THEMES } from "@/remotion/theme";
import type { StepProps } from "./useProjectEditor";

const ACCENTS = ["#FF6B4A", "#FFC83D", "#3DDC97", "#38BDF8", "#A78BFA", "#F472B6", "#D4AF37", "#FFFFFF"];
const POSITION_LABELS: Record<Style["captionPosition"], string> = { top: "위", center: "가운데", bottom: "아래" };
const PROVIDER_LABELS: Record<Voice["provider"], string> = { none: "음성 없음", openai: "OpenAI", elevenlabs: "ElevenLabs" };
type Busy = "bgm" | "logo" | "voice";

function Segmented<T extends string>({
  options,
  value,
  labels,
  onChange,
}: {
  options: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cx(
            "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
            value === option ? "bg-surface-3 text-fg" : "text-muted hover:text-fg",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-faint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function StyleStep({ project, editor, settings }: StepProps) {
  const { style, voice, scenes } = project;
  const bgmInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy | null>(null);

  const setStyle = (patch: Partial<Style>) => editor.change("style", (s) => ({ ...s, ...patch }));
  const setVoice = (patch: Partial<Voice>) => editor.change("voice", (v) => ({ ...v, ...patch }));

  async function action(kind: Busy, fn: () => Promise<{ project: Project }>, success: string) {
    setBusy(kind);
    try {
      await editor.run(fn);
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function uploadFile(kind: "bgm" | "logo", input: HTMLInputElement, success: string) {
    const file = input.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    void action(kind, () => api(`/api/projects/${project.id}/${kind}`, { method: "POST", body: form }), success);
    input.value = "";
  }

  const voiced = scenes.filter((s) => s.audioFile).length;
  const voiceKeyReady = ttsReady(settings, voice.provider);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle title="템플릿" description="자막 폰트, 전환 효과, 카메라 속도가 함께 바뀌어요." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATE_IDS.map((id) => {
            const theme = THEMES[id];
            const font = theme.subtitles?.font ?? theme.captionFont;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStyle({ template: id })}
                className={cx(
                  "overflow-hidden rounded-xl border text-left transition",
                  style.template === id ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-faint",
                )}
              >
                <div className="flex h-24 items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 px-3">
                  <span
                    style={{
                      fontFamily: font,
                      fontWeight: theme.subtitles ? 800 : theme.captionWeight,
                      color: theme.captionColor,
                      WebkitTextStroke: theme.strokeWidth ? "1px #000" : undefined,
                      textShadow: theme.textShadow,
                    }}
                    className="text-center text-xl leading-tight"
                  >
                    {theme.subtitles ? (
                      "사우나를 내 방처럼"
                    ) : (
                      <>
                        이 가격에
                        <br />
                        <span style={{ color: theme.highlightAccent ? style.accentColor : undefined }}>이 퀄리티?</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="bg-surface-2 p-3">
                  <p className="text-sm font-bold">{theme.label}</p>
                  <p className="text-xs text-muted">{theme.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="포인트 색상">
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => setStyle({ accentColor: color })}
                  className={cx(
                    "size-7 rounded-full border-2 transition",
                    style.accentColor.toUpperCase() === color ? "border-fg scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                aria-label="직접 선택"
                value={style.accentColor}
                onChange={(e) => setStyle({ accentColor: e.target.value.toUpperCase() })}
                className="size-8 cursor-pointer rounded-lg border border-line bg-transparent"
              />
            </div>
          </Field>
          <Field label="자막 위치">
            <Segmented
              options={CAPTION_POSITIONS}
              value={style.captionPosition}
              labels={POSITION_LABELS}
              onChange={(captionPosition) => setStyle({ captionPosition })}
            />
          </Field>
          <Field label="워터마크 (인스타 아이디)" htmlFor="watermark">
            <input
              id="watermark"
              className={inputClass}
              maxLength={30}
              placeholder="@my_travel"
              value={style.watermark}
              onChange={(e) => setStyle({ watermark: e.target.value })}
            />
          </Field>
          <div className="flex flex-col gap-3">
            <Toggle
              checked={style.showAdLabel}
              onChange={(showAdLabel) => setStyle({ showAdLabel })}
              label={style.template === "review" ? "영상 오른쪽 위 '(광고)' 표시" : "'광고 · 제휴링크 포함' 표시"}
              hint="공정위 추천·보증 심사지침상 영상 안에도 광고임을 알리는 게 안전해요."
            />
            <Toggle
              checked={style.showPriceBadge}
              onChange={(showPriceBadge) => setStyle({ showPriceBadge })}
              label="가격 배지 표시"
            />
            <Toggle
              checked={style.showName}
              onChange={(showName) => setStyle({ showName })}
              label="숙소 이름 공개"
              hint="꺼두면 영상·캡션에 이름이 안 나와 '여기 어디예요?' 댓글이 늘어요. 이름은 DM으로만 알려줘요."
            />
          </div>
        </div>
        {!style.showAdLabel ? (
          <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            광고 표시를 끄면 캡션 첫 줄의 광고·대가성 문구만 남아요. 제휴 수익이 있는 콘텐츠는 표시를 유지하는 걸 권장해요.
          </p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle
          title="채널 로고"
          description="영상·커버·캐러셀 왼쪽 위에 들어가요. 한 번 올리면 새로 만드는 숏폼에도 자동으로 들어가요. (배경 없는 PNG 권장)"
          action={
            <div className="flex gap-2">
              {style.logoFile ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() =>
                    void action("logo", () => api(`/api/projects/${project.id}/logo`, { method: "DELETE" }), "로고를 뺐어요.")
                  }
                >
                  빼기
                </Button>
              ) : null}
              <Button size="sm" variant="primary" loading={busy === "logo"} onClick={() => logoInput.current?.click()}>
                {style.logoFile ? "바꾸기" : "로고 올리기"}
              </Button>
            </div>
          }
        />
        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => uploadFile("logo", e.target, "로고를 넣었어요.")}
        />
        {style.logoFile ? (
          // eslint-disable-next-line @next/next/no-img-element -- local project file, not worth next/image config
          <img
            src={projectFileUrl(project.id, style.logoFile)}
            alt="채널 로고"
            className="h-16 w-auto rounded-lg bg-[repeating-conic-gradient(#333_0_25%,#222_0_50%)] bg-[length:16px_16px] p-2"
          />
        ) : (
          <p className="text-sm text-faint">로고 없음 (PNG·JPG·WEBP, 15MB까지)</p>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="배경음악"
          description="저작권 걱정 없는 음원(유튜브 오디오 보관함 등)을 쓰세요. 인스타 앱에서 음악을 붙일 거라면 비워두세요."
          action={
            <div className="flex gap-2">
              {style.bgmFile ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() =>
                    void action("bgm", () => api(`/api/projects/${project.id}/bgm`, { method: "DELETE" }), "배경음악을 뺐어요.")
                  }
                >
                  빼기
                </Button>
              ) : null}
              <Button size="sm" variant="primary" loading={busy === "bgm"} onClick={() => bgmInput.current?.click()}>
                {style.bgmFile ? "바꾸기" : "음악 올리기"}
              </Button>
            </div>
          }
        />
        <input
          ref={bgmInput}
          type="file"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
          hidden
          onChange={(e) => uploadFile("bgm", e.target, "배경음악을 넣었어요.")}
        />
        {style.bgmFile ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <audio controls src={projectFileUrl(project.id, style.bgmFile)} className="h-10 w-full sm:max-w-xs" />
            <Field label={`볼륨 ${Math.round(style.bgmVolume * 100)}%`} className="flex-1">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={style.bgmVolume}
                onChange={(e) => setStyle({ bgmVolume: Number(e.target.value) })}
              />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-faint">배경음악 없음 (MP3·WAV·M4A, 20MB까지)</p>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="AI 나레이션"
          description="장면 길이는 나레이션 길이에 맞춰 자동으로 늘어나요."
          action={voiced ? <Badge tone="success">{`${voiced}/${scenes.length} 장면 음성 완료`}</Badge> : null}
        />
        <div className="flex flex-col gap-4">
          <Segmented
            options={TTS_PROVIDERS}
            value={voice.provider}
            labels={PROVIDER_LABELS}
            onChange={(provider) =>
              setVoice({ provider, voiceId: provider === "openai" ? "nova" : provider === "elevenlabs" ? "" : voice.voiceId })
            }
          />
          {voice.provider !== "none" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {voice.provider === "openai" ? (
                  <Field label="목소리" htmlFor="voiceId">
                    <select
                      id="voiceId"
                      className={inputClass}
                      value={voice.voiceId || "nova"}
                      onChange={(e) => setVoice({ voiceId: e.target.value })}
                    >
                      {OPENAI_VOICES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Voice ID" hint="ElevenLabs 보이스 라이브러리에서 복사한 ID (비우면 기본 목소리)" htmlFor="voiceId">
                    <input
                      id="voiceId"
                      className={inputClass}
                      maxLength={60}
                      placeholder={ELEVENLABS_DEFAULT_VOICE}
                      value={voice.voiceId}
                      onChange={(e) => setVoice({ voiceId: e.target.value.trim() })}
                    />
                  </Field>
                )}
                <Field label={`말하기 속도 ${voice.speed.toFixed(2)}x`}>
                  <input
                    type="range"
                    min={0.7}
                    max={1.5}
                    step={0.05}
                    value={voice.speed}
                    onChange={(e) => setVoice({ speed: Number(e.target.value) })}
                  />
                </Field>
              </div>
              {!voiceKeyReady ? (
                <p className="text-sm text-warning">
                  {PROVIDER_LABELS[voice.provider]} API 키가 없어요.{" "}
                  <Link href="/settings" className="underline underline-offset-2">
                    설정에서 입력하기
                  </Link>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  loading={busy === "voice"}
                  disabled={!voiceKeyReady || scenes.length === 0 || busy !== null}
                  onClick={() =>
                    void action(
                      "voice",
                      () => api(`/api/projects/${project.id}/voice`, { method: "POST" }),
                      "나레이션을 만들었어요. 미리보기에서 들어보세요.",
                    )
                  }
                >
                  {voiced ? "나레이션 다시 만들기" : "나레이션 생성"}
                </Button>
                {voiced ? (
                  <Button
                    variant="danger"
                    disabled={busy !== null}
                    onClick={() =>
                      void action("voice", () => api(`/api/projects/${project.id}/voice`, { method: "DELETE" }), "나레이션을 지웠어요.")
                    }
                  >
                    나레이션 지우기
                  </Button>
                ) : null}
              </div>
              {scenes.length === 0 ? <p className="text-xs text-faint">대본을 먼저 만들어야 나레이션을 생성할 수 있어요.</p> : null}
            </>
          ) : (
            <p className="text-sm text-faint">자막과 음악만으로 만들어요. 릴스는 무음 시청이 많아 자막만으로도 충분히 효과적이에요.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
