"use client";

import { openSettings } from "@/components/settings/SettingsDialog";
import { useMemo, useRef, useState } from "react";
import { toast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  Field,
  inputClass,
  SectionTitle,
  cx,
} from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { ttsReady } from "@/lib/settings-view";
import {
  CAPTION_POSITIONS,
  SUBTITLE_STYLES,
  ELEVENLABS_DEFAULT_VOICE,
  GEMINI_VOICES,
  TYPECAST_VOICES,
  OPENAI_VOICES,
  TEMPLATE_IDS,
  CUT_PACES,
  type BgmTrack,
  type CutPace,
  type Project,
  type Style,
  type Voice,
} from "@/lib/types";
import { THEMES } from "@/remotion/theme";
import type { StepProps } from "./useProjectEditor";
import { buildVideoProps } from "@/lib/video/props";
import { refitReviewShots } from "@/lib/script/review";
import { ChannelDecorDialog } from "./ChannelDecorDialog";
import { VoiceAvatar } from "./VoiceAvatar";
import { VoicePickerDialog } from "./VoicePickerDialog";

const TRACKS: { id: BgmTrack; label: string; hint: string }[] = [
  { id: "calm", label: "잔잔한 감성", hint: "피아노 · 따뜻한 패드" },
  { id: "bright", label: "산뜻한 여행", hint: "우쿨렐레 · 경쾌한 리듬" },
  { id: "lofi", label: "로파이 휴식", hint: "느긋한 건반 · 레코드 잡음" },
  { id: "wings1", label: "윙스 BGM 1", hint: "윙스 제작 자료 · 1분 13초" },
  { id: "wings2", label: "윙스 BGM 2", hint: "윙스 제작 자료 · 1분 2초" },
  { id: "wings3", label: "윙스 BGM 3", hint: "윙스 제작 자료 · 1분 8초" },
  { id: "wings4", label: "윙스 BGM 4", hint: "윙스 제작 자료 · 1분 21초" },
  { id: "wings5", label: "윙스 BGM 5", hint: "윙스 제작 자료 · 1분 4초" },
  { id: "wings6", label: "윙스 BGM 6", hint: "윙스 제작 자료 · 58초" },
  { id: "none", label: "음악 없음", hint: "인스타에서 붙일게요" },
];

const PACES: { id: CutPace; label: string }[] = [
  { id: "fast", label: "빠르게" },
  { id: "normal", label: "보통" },
  { id: "slow", label: "느리게" },
];

const ACCENTS = [
  "#FF6B4A",
  "#FFC83D",
  "#3DDC97",
  "#38BDF8",
  "#A78BFA",
  "#F472B6",
  "#D4AF37",
  "#FFFFFF",
];
const POSITION_LABELS: Record<Style["captionPosition"], string> = {
  top: "위",
  center: "가운데",
  bottom: "아래",
};
const SUBTITLE_STYLE_LABELS: Record<Style["subtitleStyle"], string> = {
  serif: "명조 · 허지니형",
  bold: "굵은 고딕 · 런비형",
};
const PROVIDER_LABELS: Record<Voice["provider"], string> = {
  none: "음성 없음",
  typecast: "Typecast",
  gemini: "Gemini",
  elevenlabs: "ElevenLabs",
  openai: "OpenAI",
};
/** Every pickable character (Typecast/Gemini/OpenAI), for the current-voice card. */
const VOICE_CHARACTERS: {
  provider: Voice["provider"];
  id: string;
  name: string;
  tone: string;
  gender: "female" | "male";
}[] = [
  ...TYPECAST_VOICES.map((v) => ({
    provider: "typecast" as const,
    id: v.id,
    name: v.name,
    tone: v.tone,
    gender: v.gender,
  })),
  ...GEMINI_VOICES.map((v) => ({
    provider: "gemini" as const,
    id: v.id,
    name: v.name,
    tone: v.tone,
    gender: v.gender,
  })),
  ...OPENAI_VOICES.map((v) => ({
    provider: "openai" as const,
    id: v,
    name: v[0].toUpperCase() + v.slice(1),
    tone: "또렷한 기본 목소리",
    gender: (["nova", "shimmer", "coral", "sage"].includes(v)
      ? "female"
      : "male") as "female" | "male",
  })),
  {
    provider: "elevenlabs",
    id: ELEVENLABS_DEFAULT_VOICE,
    name: "Rachel",
    tone: "기본 다국어 여성",
    gender: "female",
  },
];
const defaultVoiceId = (provider: Voice["provider"]) =>
  provider === "typecast"
    ? TYPECAST_VOICES[0].id
    : provider === "gemini"
      ? GEMINI_VOICES[0].id
      : provider === "openai"
        ? "nova"
        : ELEVENLABS_DEFAULT_VOICE;
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
            value === option
              ? "bg-surface-3 text-fg"
              : "text-muted hover:text-fg",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-faint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function StyleStep({
  project,
  editor,
  settings,
  openEditor,
}: StepProps) {
  const { style, voice, scenes } = project;
  const bgmInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy | null>(null);

  const setStyle = (patch: Partial<Style>) =>
    editor.change("style", (s) => ({ ...s, ...patch }));
  const setVoice = (patch: Partial<Voice>) =>
    editor.change("voice", (v) => ({ ...v, ...patch }));
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [decorOpen, setDecorOpen] = useState(false);
  // Composition props for the real-frame previews in 채널 꾸미기.
  const decorProps = useMemo(
    () => buildVideoProps(project, (file) => projectFileUrl(project.id, file)),
    [project],
  );

  async function action(
    kind: Busy,
    fn: () => Promise<{ project: Project }>,
    success: string,
    then?: () => void,
  ) {
    setBusy(kind);
    try {
      await editor.run(fn);
      toast.success(success);
      then?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function uploadFile(
    kind: "bgm" | "logo",
    input: HTMLInputElement,
    success: string,
  ) {
    const file = input.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    void action(
      kind,
      () =>
        api(`/api/projects/${project.id}/${kind}`, {
          method: "POST",
          body: form,
        }),
      success,
    );
    input.value = "";
  }

  const voiced = scenes.filter((s) => s.audioFile).length;
  const current = VOICE_CHARACTERS.find(
    (c) =>
      c.provider === voice.provider &&
      c.id === (voice.voiceId || defaultVoiceId(voice.provider)),
  );
  const firstPhoto = project.assets[0];
  const previewPhoto = firstPhoto
    ? projectFileUrl(project.id, firstPhoto.file)
    : null;
  const voiceKeyReady = ttsReady(settings, voice.provider);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle
          title="글꼴 선택"
          description="자막 글꼴, 전환 효과, 카메라 속도가 함께 바뀌어요. 미리보기는 이 숙소 사진으로 보여드려요."
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => setDecorOpen(true)}
            >
              채널 꾸미기
            </Button>
          }
        />
        {/* Mounted only while open: it holds six live video players. */}
        {decorOpen ? (
          <ChannelDecorDialog
            open={decorOpen}
            onClose={() => setDecorOpen(false)}
            style={style}
            setStyle={setStyle}
            baseProps={decorProps}
            logoSrc={
              style.logoFile ? projectFileUrl(project.id, style.logoFile) : null
            }
            onPickLogo={() => logoInput.current?.click()}
          />
        ) : null}
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
                  style.template === id
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-line hover:border-faint",
                )}
              >
                <div
                  className="relative flex h-28 items-center justify-center overflow-hidden bg-surface-3 bg-cover bg-center px-3"
                  style={
                    previewPhoto
                      ? { backgroundImage: `url(${previewPhoto})` }
                      : undefined
                  }
                >
                  {/* Light scrim only: the card stays bright like the real reel, text stays legible. */}
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/10"
                  />
                  <span
                    style={{
                      fontFamily: font,
                      fontWeight: theme.subtitles ? 800 : theme.captionWeight,
                      color: theme.captionColor,
                      // Scaled-down outline: the reel's 14px stroke at ~1/5 size, painted under the fill.
                      WebkitTextStroke: theme.strokeWidth
                        ? "3px #111"
                        : undefined,
                      paintOrder: "stroke fill",
                      textShadow: theme.strokeWidth
                        ? "0 2px 4px rgba(0,0,0,0.3)"
                        : "0 1px 8px rgba(0,0,0,0.6)",
                    }}
                    className="relative text-center text-xl leading-tight"
                  >
                    {theme.subtitles ? (
                      "사우나를 내 방처럼"
                    ) : (
                      <>
                        이 가격에
                        <br />
                        <span
                          style={{
                            color: theme.highlightAccent
                              ? style.accentColor
                              : undefined,
                          }}
                        >
                          이 퀄리티?
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="bg-surface p-3">
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
                    style.accentColor.toUpperCase() === color
                      ? "border-fg scale-110"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                aria-label="직접 선택"
                value={style.accentColor}
                onChange={(e) =>
                  setStyle({ accentColor: e.target.value.toUpperCase() })
                }
                className="size-8 cursor-pointer rounded-lg border border-line bg-transparent"
              />
            </div>
          </Field>
          {THEMES[style.template].subtitles ? (
            <Field label="말자막 스타일">
              <Segmented
                options={SUBTITLE_STYLES}
                value={style.subtitleStyle}
                labels={SUBTITLE_STYLE_LABELS}
                onChange={(subtitleStyle) => setStyle({ subtitleStyle })}
              />
            </Field>
          ) : (
            <Field label="자막 위치">
              <Segmented
                options={CAPTION_POSITIONS}
                value={style.captionPosition}
                labels={POSITION_LABELS}
                onChange={(captionPosition) => setStyle({ captionPosition })}
              />
            </Field>
          )}
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
              label={
                style.template === "review"
                  ? "영상 오른쪽 위 '(광고)' 표시"
                  : "'광고 · 제휴링크 포함' 표시"
              }
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
            광고 표시를 끄면 캡션 첫 줄의 광고·대가성 문구만 남아요. 제휴 수익이
            있는 콘텐츠는 표시를 유지하는 걸 권장해요.
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
                    void action(
                      "logo",
                      () =>
                        api(`/api/projects/${project.id}/logo`, {
                          method: "DELETE",
                        }),
                      "로고를 뺐어요.",
                    )
                  }
                >
                  빼기
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="primary"
                loading={busy === "logo"}
                onClick={() => logoInput.current?.click()}
              >
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
          <p className="text-sm text-faint">
            로고 없음 (PNG·JPG·WEBP, 15MB까지)
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="배경음악"
          description="잔잔한 감성·산뜻한 여행·로파이는 프로그램이 직접 만든 곡, 윙스 BGM은 윙스 제작 자료 곡이에요. 내 음악을 올리면 그걸 먼저 써요."
          action={
            <div className="flex gap-2">
              {style.bgmFile ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() =>
                    void action(
                      "bgm",
                      () =>
                        api(`/api/projects/${project.id}/bgm`, {
                          method: "DELETE",
                        }),
                      "올린 음악을 뺐어요.",
                    )
                  }
                >
                  올린 음악 빼기
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                loading={busy === "bgm"}
                onClick={() => bgmInput.current?.click()}
              >
                {style.bgmFile ? "음악 바꾸기" : "내 음악 올리기"}
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
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 sm:flex-row sm:items-center">
            <Badge tone="success">올린 음악 사용 중</Badge>
            <audio controls src={projectFileUrl(project.id, style.bgmFile)} className="h-10 w-full sm:max-w-xs" />
          </div>
        ) : null}
        <div className={cx("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", style.bgmFile && "opacity-50")} role="radiogroup" aria-label="기본 배경음악">
          {TRACKS.map((t) => {
            const active = style.bgmTrack === t.id;
            return (
              <div
                key={t.id}
                className={cx(
                  "flex flex-col gap-2 rounded-xl border p-3 transition",
                  active ? "border-accent bg-accent/5 ring-2 ring-accent/20" : "border-line hover:border-accent/40",
                )}
              >
                <button type="button" role="radio" aria-checked={active} onClick={() => setStyle({ bgmTrack: t.id })} className="text-left">
                  <p className={cx("text-sm font-bold", active ? "text-accent" : "text-fg")}>{t.label}</p>
                  <p className="text-xs text-muted">{t.hint}</p>
                </button>
                {t.id !== "none" ? <audio controls preload="none" src={`/audio/bgm-${t.id}.mp3`} className="h-8 w-full" /> : null}
              </div>
            );
          })}
        </div>
        <Field label={`음악 볼륨 ${Math.round(style.bgmVolume * 100)}%`} className="mt-4">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={style.bgmVolume}
            onChange={(e) => setStyle({ bgmVolume: Number(e.target.value) })}
          />
        </Field>
      </Card>

      <Card>
        <SectionTitle
          title="효과음 · 모션그래픽 · 컷 속도"
          description="장면이 바뀔 때 효과음과 움직이는 그래픽을 넣어 덜 밋밋하게 만들어요."
        />
        <div className="flex flex-col gap-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent)]" checked={style.sfx} onChange={(e) => setStyle({ sfx: e.target.checked })} />
            <span>
              <span className="block text-sm font-bold">효과음</span>
              <span className="block text-xs text-muted">첫 장면 &lsquo;쿵&rsquo;, 장면 바뀔 때 &lsquo;휙&rsquo;, 마지막 문장 &lsquo;딩&rsquo;</span>
            </span>
          </label>
          {style.sfx ? (
            <Field label={`효과음 볼륨 ${Math.round(style.sfxVolume * 100)}%`} className="ml-7">
              <input type="range" min={0} max={1} step={0.05} value={style.sfxVolume} onChange={(e) => setStyle({ sfxVolume: Number(e.target.value) })} />
            </Field>
          ) : null}
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent)]" checked={style.motion} onChange={(e) => setStyle({ motion: e.target.checked })} />
            <span>
              <span className="block text-sm font-bold">모션그래픽</span>
              <span className="block text-xs text-muted">시작 플래시, 📍지역 태그, 자막 속 숫자 강조, 진행 바, 마지막 &lsquo;저장 필수&rsquo; 스티커</span>
            </span>
          </label>
          <div>
            <p className="text-sm font-bold">사진 컷 속도</p>
            <p className="text-xs text-muted">사진이 바뀌는 간격이에요. 바꾸면 장면마다 들어가는 사진 수가 바로 다시 정리돼요.</p>
            <div className="mt-2 inline-flex rounded-full bg-surface-2 p-1" role="radiogroup" aria-label="사진 컷 속도">
              {PACES.map((pace) => (
                <button
                  key={pace.id}
                  type="button"
                  role="radio"
                  aria-checked={style.cutPace === pace.id}
                  onClick={() => {
                    setStyle({ cutPace: pace.id });
                    if (style.template === "review" && scenes.length) {
                      editor.change("scenes", (list) => refitReviewShots(list, project.assets, CUT_PACES[pace.id]));
                    }
                  }}
                  className={cx(
                    "rounded-full px-4 py-1.5 text-sm font-bold transition",
                    style.cutPace === pace.id ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                  )}
                >
                  {pace.label} <span className="tabular text-xs font-semibold text-muted">{CUT_PACES[pace.id]}초</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="AI 나레이션"
          description="장면 길이는 나레이션 길이에 맞춰 자동으로 늘어나요."
          action={
            voiced ? (
              <Badge tone="success">{`${voiced}/${scenes.length} 장면 음성 완료`}</Badge>
            ) : null
          }
        />
        <div className="flex flex-col gap-4">
          {/* Current voice as a character card; the full picker (faces + samples) is a popup. */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface-2 p-4">
            {current ? (
              <VoiceAvatar
                seed={current.id}
                gender={current.gender}
                size={64}
              />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-full bg-surface-3 text-2xl text-faint">
                ∅
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">
                {voice.provider === "none"
                  ? "나레이션 없음"
                  : (current?.name ?? voice.voiceId)}
              </p>
              <p className="text-xs text-muted">
                {voice.provider === "none"
                  ? "자막만 나와요. 벤치마크 영상은 모두 나레이션이 있어요."
                  : `${PROVIDER_LABELS[voice.provider]} · ${current?.tone ?? "직접 입력한 목소리"}`}
              </p>
            </div>
            <div className="flex gap-2">
              {voice.provider !== "none" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setVoice({ provider: "none", voiceId: "" })}
                >
                  나레이션 끄기
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="primary"
                onClick={() => setVoiceOpen(true)}
              >
                목소리 고르기
              </Button>
            </div>
          </div>
          <VoicePickerDialog
            open={voiceOpen}
            voice={voice}
            settings={settings}
            onClose={() => setVoiceOpen(false)}
            onPick={setVoice}
          />
          {voice.provider !== "none" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {voice.provider === "elevenlabs" ? (
                  <Field
                    label="Voice ID (선택)"
                    hint="ElevenLabs 보이스 라이브러리에서 복사한 ID (비우면 기본 목소리)"
                    htmlFor="voiceId"
                  >
                    <input
                      id="voiceId"
                      className={inputClass}
                      maxLength={60}
                      placeholder={ELEVENLABS_DEFAULT_VOICE}
                      value={voice.voiceId}
                      onChange={(e) =>
                        setVoice({ voiceId: e.target.value.trim() })
                      }
                    />
                  </Field>
                ) : null}
                <Field label={`말하기 속도 ${voice.speed.toFixed(2)}x`}>
                  <input
                    type="range"
                    min={0.7}
                    max={1.5}
                    step={0.05}
                    value={voice.speed}
                    onChange={(e) =>
                      setVoice({ speed: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              {!voiceKeyReady ? (
                <p className="text-sm text-warning">
                  {PROVIDER_LABELS[voice.provider]} API 키가 없어요.{" "}
                  <button
                    type="button"
                    onClick={openSettings}
                    className="underline underline-offset-2"
                  >
                    설정에서 입력하기
                  </button>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  loading={busy === "voice"}
                  disabled={
                    !voiceKeyReady || scenes.length === 0 || busy !== null
                  }
                  onClick={() =>
                    void action(
                      "voice",
                      () =>
                        api(`/api/projects/${project.id}/voice`, {
                          method: "POST",
                        }),
                      "나레이션을 만들었어요. 편집기에서 장면별로 확인하세요.",
                      // Script + voice ready → straight into the video-editor step.
                      openEditor,
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
                      void action(
                        "voice",
                        () =>
                          api(`/api/projects/${project.id}/voice`, {
                            method: "DELETE",
                          }),
                        "나레이션을 지웠어요.",
                      )
                    }
                  >
                    나레이션 지우기
                  </Button>
                ) : null}
              </div>
              {scenes.length === 0 ? (
                <p className="text-xs text-faint">
                  대본을 먼저 만들어야 나레이션을 생성할 수 있어요.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-faint">
              자막과 음악만으로 만들어요. 릴스는 무음 시청이 많아 자막만으로도
              충분히 효과적이에요.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
