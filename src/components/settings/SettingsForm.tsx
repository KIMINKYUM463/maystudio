"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Field, inputClass, SectionTitle, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import type { MaskedSettings, SecretKey } from "@/lib/settings-view";
import { DEFAULT_REPLICATE_MODEL, REPLICATE_I2V_MODELS } from "@/lib/replicate-models";
import { LLM_PROVIDERS, SECRET_SETTING_KEYS, type Settings } from "@/lib/types";
import { announceSettingsSaved } from "./SettingsDialog";

type PlainSettings = Omit<Settings, SecretKey>;
type PlainKey = keyof PlainSettings;

const PROVIDER_LABELS: Record<Settings["llmProvider"], string> = {
  none: "사용 안 함 (템플릿 대본)",
  openai: "OpenAI (GPT)",
  anthropic: "Anthropic (Claude)",
  gemini: "Google (Gemini)",
};

const MODEL_FIELD: Record<Exclude<Settings["llmProvider"], "none">, "openaiModel" | "anthropicModel" | "geminiModel"> = {
  openai: "openaiModel",
  anthropic: "anthropicModel",
  gemini: "geminiModel",
};

const SECRETS: Array<{ key: SecretKey; label: string; hint: string; href: string }> = [
  { key: "openaiKey", label: "OpenAI API 키", hint: "AI 대본(GPT)과 OpenAI 음성에 함께 쓰여요.", href: "https://platform.openai.com/api-keys" },
  { key: "anthropicKey", label: "Anthropic API 키", hint: "Claude로 대본을 쓸 때 필요해요.", href: "https://console.anthropic.com/settings/keys" },
  { key: "geminiKey", label: "Gemini API 키", hint: "Gemini로 대본을 쓸 때 필요해요.", href: "https://aistudio.google.com/apikey" },
  { key: "typecastKey", label: "Typecast API 키", hint: "한국어 나레이션 목소리. 키가 있으면 새 숏폼에 자동으로 켜져요.", href: "https://typecast.ai/developers" },
  { key: "elevenlabsKey", label: "ElevenLabs API 키", hint: "자연스러운 한국어 음성이 필요할 때.", href: "https://elevenlabs.io/app/settings/api-keys" },
  {
    key: "replicateKey",
    label: "AI 영상 키 (Replicate)",
    hint: "숙소 사진을 영상으로 바꿀 때 써요. Google Flow 대신 프로그램 안에서 바로 만들어요.",
    href: "https://replicate.com/account/api-tokens",
  },
];

const META_SECRETS: typeof SECRETS = [
  {
    key: "metaToken",
    label: "메타 연결 키 (사용자 액세스 토큰)",
    hint: "그래프 API 탐색기에서 instagram_basic, pages_show_list, business_management 권한으로 발급해요.",
    href: "https://developers.facebook.com/tools/explorer/",
  },
  {
    key: "metaAppSecret",
    label: "메타 앱 시크릿 (선택)",
    hint: "앱 ID와 함께 넣으면 연결 키를 30일마다 자동으로 새로 받아 만료되지 않아요.",
    href: "https://developers.facebook.com/apps/",
  },
];

const INTERVALS = [1, 2, 3, 6, 12, 24];

type ReelStatus = { reels: number; runs: number; lastRun: number | null; lastError: string | null; failed: { account: string; error: string }[] };

const SECRET_KEYS = new Set<string>(SECRET_SETTING_KEYS);

function plainPart(settings: MaskedSettings): PlainSettings {
  const entries = Object.entries(settings).filter(([key]) => key !== "configured" && !SECRET_KEYS.has(key));
  return Object.fromEntries(entries) as PlainSettings;
}

export function SettingsForm() {
  const [saved, setSaved] = useState<MaskedSettings | null>(null);
  const [form, setForm] = useState<PlainSettings | null>(null);
  const [secrets, setSecrets] = useState<Partial<Record<SecretKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [reelStatus, setReelStatus] = useState<ReelStatus | null>(null);
  const [reelBusy, setReelBusy] = useState<"connect" | "collect" | null>(null);

  function adopt(settings: MaskedSettings) {
    setSaved(settings);
    setForm(plainPart(settings));
    setSecrets({});
  }

  useEffect(() => {
    api<{ settings: MaskedSettings }>("/api/settings")
      .then(({ settings }) => adopt(settings))
      .catch((error) => toast.error(errorMessage(error)));
    api<ReelStatus>("/api/reels/collect")
      .then(setReelStatus)
      .catch(() => {});
  }, []);

  if (!form || !saved) {
    return (
      <div className="flex justify-center py-24 text-muted">
        <Spinner className="size-6" />
      </div>
    );
  }

  const set = <K extends PlainKey>(key: K, value: PlainSettings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const text = (key: PlainKey) => ({
    value: String(form[key]),
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });

  async function persist() {
    const { settings } = await api<{ settings: MaskedSettings }>("/api/settings", {
      method: "PUT",
      json: { ...form, ...secrets },
    });
    adopt(settings);
    announceSettingsSaved(settings);
    return settings;
  }

  async function save() {
    setSaving(true);
    try {
      await persist();
      toast.success("설정을 저장했어요.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  /** Saves first so the typed key is the one checked, then finds the Instagram account behind it. */
  async function connectMeta() {
    setReelBusy("connect");
    try {
      await persist();
      const ig = await api<{ id: string; username: string }>("/api/reels/connect", { method: "POST" });
      set("igUserId", ig.id);
      toast.success(`인스타그램 ${ig.username ? "@" + ig.username : "계정"}과 연결됐어요.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReelBusy(null);
    }
  }

  async function collectNow() {
    setReelBusy("collect");
    try {
      await persist();
      const next = await api<ReelStatus>("/api/reels/collect", { method: "POST" });
      setReelStatus(next);
      if (next.lastError) toast.error(next.lastError);
      else toast.success(`릴스 ${next.reels}개를 모았어요.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReelBusy(null);
    }
  }

  const secretField = (s: (typeof SECRETS)[number]) => {
    const edited = secrets[s.key];
    return (
      <Field
        key={s.key}
        label={s.label}
        htmlFor={s.key}
        hint={
          <>
            {s.hint}{" "}
            <a href={s.href} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
              키 발급
            </a>
          </>
        }
      >
        <div className="flex items-center gap-2">
          <input
            id={s.key}
            type="password"
            autoComplete="off"
            className={inputClass}
            placeholder={saved.configured[s.key] ? saved[s.key] : "입력하지 않음"}
            value={edited ?? ""}
            onChange={(e) => setSecrets((prev) => ({ ...prev, [s.key]: e.target.value }))}
          />
          {edited === "" && saved.configured[s.key] ? (
            <Badge tone="danger">저장 시 삭제</Badge>
          ) : saved.configured[s.key] ? (
            <>
              <Badge tone="success">등록됨</Badge>
              <Button size="sm" variant="ghost" onClick={() => setSecrets((prev) => ({ ...prev, [s.key]: "" }))}>
                삭제
              </Button>
            </>
          ) : null}
        </div>
      </Field>
    );
  };

  const provider = form.llmProvider;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle title="AI 대본" description="키가 없으면 내장 훅 라이브러리로 대본을 만들어요. AI를 쓰면 상품마다 더 자연스러운 문장이 나와요." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="AI 제공자" htmlFor="llmProvider">
            <select
              id="llmProvider"
              className={inputClass}
              value={provider}
              onChange={(e) => set("llmProvider", e.target.value as Settings["llmProvider"])}
            >
              {LLM_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          {provider !== "none" ? (
            <Field label="모델 이름" hint="제공사 콘솔에 표시된 모델 ID를 그대로 입력하세요." htmlFor="model">
              <input id="model" className={inputClass} {...text(MODEL_FIELD[provider])} />
            </Field>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionTitle title="API 키" description="이 컴퓨터의 data/settings.json에만 저장되고, 화면에는 일부만 보여요." />
        <div className="flex flex-col gap-4">
          {SECRETS.map(secretField)}
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="사진을 AI 영상으로 (Replicate)"
          description="숙소 사진을 몇 초짜리 움직이는 영상으로 바꿔요. 자막·로고는 자동으로 위에 얹혀요. 만든 만큼 Replicate 요금이 나가요."
        />
        <Field label="모델" hint={REPLICATE_I2V_MODELS.find((m) => m.id === form.replicateModel)?.hint} htmlFor="replicateModel">
          <select
            id="replicateModel"
            className={inputClass}
            value={REPLICATE_I2V_MODELS.some((m) => m.id === form.replicateModel) ? form.replicateModel : DEFAULT_REPLICATE_MODEL}
            onChange={(e) => set("replicateModel", e.target.value)}
          >
            {REPLICATE_I2V_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card>
        <SectionTitle
          title="릴스 자동 수집 (메타 공식 연결)"
          description="지켜볼 여행 릴스 계정의 조회수·댓글을 정해진 시간마다 모아서 숙소 지도의 '오늘 터진 릴스'를 새로 채워요. 앱이 켜져 있는 동안 돌아가요."
        />
        <div className="flex flex-col gap-4">
          {META_SECRETS.map(secretField)}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="메타 앱 ID (선택)" htmlFor="metaAppId">
              <input id="metaAppId" className={inputClass} inputMode="numeric" {...text("metaAppId")} />
            </Field>
            <Field label="연결된 인스타 계정" htmlFor="igUserId" hint="키를 넣고 '연결 확인'을 누르면 자동으로 채워져요.">
              <div className="flex items-center gap-2">
                <input id="igUserId" className={inputClass} readOnly value={form.igUserId} placeholder="아직 연결 안 됨" />
                <Button size="sm" onClick={connectMeta} loading={reelBusy === "connect"} disabled={Boolean(reelBusy)}>
                  연결 확인
                </Button>
              </div>
            </Field>
          </div>
          <Field
            label="지켜볼 인스타 계정"
            htmlFor="reelAccounts"
            hint="한 줄에 하나씩, @아이디나 프로필 주소로 넣어요. 비즈니스·크리에이터 계정만 읽을 수 있어요."
          >
            <textarea
              id="reelAccounts"
              rows={5}
              className={`${inputClass} h-auto py-2 font-mono text-[13px]`}
              placeholder={"@travel_account1\n@travel_account2"}
              {...text("reelAccounts")}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="수집 간격" htmlFor="reelIntervalHours">
              <select
                id="reelIntervalHours"
                className={inputClass}
                value={form.reelIntervalHours}
                onChange={(e) => set("reelIntervalHours", Number(e.target.value))}
              >
                {INTERVALS.map((h) => (
                  <option key={h} value={h}>
                    {h}시간마다
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={collectNow} loading={reelBusy === "collect"} disabled={Boolean(reelBusy)}>
              지금 수집
            </Button>
          </div>
          {reelStatus ? (
            <p className="text-xs text-muted" role="status">
              {reelStatus.lastRun
                ? `마지막 수집 ${new Date(reelStatus.lastRun).toLocaleString("ko-KR")} · 릴스 ${reelStatus.reels}개 · 누적 ${reelStatus.runs}회`
                : "아직 수집한 적 없어요."}
              {reelStatus.failed.length
                ? ` · 실패 ${reelStatus.failed.length}개 계정 (${reelStatus.failed.slice(0, 3).map((f) => "@" + f.account).join(", ")})`
                : ""}
              {reelStatus.lastError ? <span className="mt-1 block text-danger">{reelStatus.lastError}</span> : null}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionTitle title="채널 기본값" description="새 프로젝트를 만들 때 자동으로 들어가요." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="인스타그램 아이디 (워터마크)" htmlFor="instagramHandle">
            <input id="instagramHandle" className={inputClass} maxLength={30} placeholder="@my_travel" {...text("instagramHandle")} />
          </Field>
          <Field label="기본 댓글 키워드" htmlFor="defaultCommentKeyword">
            <input id="defaultCommentKeyword" className={inputClass} maxLength={10} {...text("defaultCommentKeyword")} />
          </Field>
          <Field label="링크 페이지 제목" htmlFor="linkPageTitle">
            <input id="linkPageTitle" className={inputClass} maxLength={40} {...text("linkPageTitle")} />
          </Field>
          <Field label="링크 페이지 소개" htmlFor="linkPageBio">
            <input id="linkPageBio" className={inputClass} maxLength={120} {...text("linkPageBio")} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={save} loading={saving}>
          저장하기
        </Button>
      </div>
    </div>
  );
}
