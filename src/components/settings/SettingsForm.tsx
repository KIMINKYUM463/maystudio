"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Field, inputClass, SectionTitle, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import type { MaskedSettings, SecretKey } from "@/lib/settings-view";
import { DEFAULT_REPLICATE_MODEL, REPLICATE_I2V_MODELS } from "@/lib/replicate-models";
import { LLM_PROVIDERS, type Settings } from "@/lib/types";

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
  { key: "elevenlabsKey", label: "ElevenLabs API 키", hint: "자연스러운 한국어 음성이 필요할 때.", href: "https://elevenlabs.io/app/settings/api-keys" },
  {
    key: "replicateKey",
    label: "Replicate API 토큰",
    hint: "숙소 사진을 영상으로 바꿀 때 써요. Google Flow 대신 프로그램 안에서 바로 만들어요.",
    href: "https://replicate.com/account/api-tokens",
  },
];

const SECRET_KEYS = new Set<string>(SECRETS.map((s) => s.key));

function plainPart(settings: MaskedSettings): PlainSettings {
  const entries = Object.entries(settings).filter(([key]) => key !== "configured" && !SECRET_KEYS.has(key));
  return Object.fromEntries(entries) as PlainSettings;
}

export function SettingsForm() {
  const [saved, setSaved] = useState<MaskedSettings | null>(null);
  const [form, setForm] = useState<PlainSettings | null>(null);
  const [secrets, setSecrets] = useState<Partial<Record<SecretKey, string>>>({});
  const [saving, setSaving] = useState(false);

  function adopt(settings: MaskedSettings) {
    setSaved(settings);
    setForm(plainPart(settings));
    setSecrets({});
  }

  useEffect(() => {
    api<{ settings: MaskedSettings }>("/api/settings")
      .then(({ settings }) => adopt(settings))
      .catch((error) => toast.error(errorMessage(error)));
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

  async function save() {
    setSaving(true);
    try {
      const { settings } = await api<{ settings: MaskedSettings }>("/api/settings", {
        method: "PUT",
        json: { ...form, ...secrets },
      });
      adopt(settings);
      toast.success("설정을 저장했어요.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

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
          {SECRETS.map((s) => {
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
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="사진 → 영상 (Replicate)"
          description="배경 영상(사진→mp4)만 만듭니다. 자막·로고·전환 모션그래픽은 Remotion이 위에 따로 올립니다. 사용량만큼 Replicate 요금이 나가요."
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
