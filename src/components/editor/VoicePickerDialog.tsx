"use client";

import { useEffect, useRef, useState } from "react";
import { cx, Spinner } from "@/components/ui";
import { ttsReady, type MaskedSettings } from "@/lib/settings-view";
import { ELEVENLABS_VOICES, GEMINI_VOICES, OPENAI_VOICES, TYPECAST_VOICES, type Voice } from "@/lib/types";
import { VoiceAvatar } from "./VoiceAvatar";

type Provider = Exclude<Voice["provider"], "none">;
type Character = { id: string; name: string; tone: string; gender: "female" | "male" };

const PROVIDERS: { id: Provider; label: string; note: string }[] = [
  { id: "typecast", label: "Typecast", note: "한국어 쇼츠 전용 목소리" },
  { id: "gemini", label: "Gemini", note: "말투를 문장으로 지시" },
  { id: "elevenlabs", label: "ElevenLabs", note: "가장 자연스러운 감정" },
  { id: "openai", label: "OpenAI", note: "또렷한 기본 목소리" },
];

const OPENAI_CHARACTERS: Character[] = OPENAI_VOICES.map((v) => ({
  id: v,
  name: v[0].toUpperCase() + v.slice(1),
  tone: ["nova", "shimmer", "coral", "sage"].includes(v) ? "여성 · 밝고 또렷" : "남성 · 차분",
  gender: ["nova", "shimmer", "coral", "sage"].includes(v) ? "female" : "male",
}));

const CHARACTERS: Record<Provider, Character[]> = {
  typecast: TYPECAST_VOICES.map((v) => ({ id: v.id, name: v.name, tone: v.tone, gender: v.gender })),
  gemini: GEMINI_VOICES.map((v) => ({ id: v.id, name: v.name, tone: v.tone, gender: v.gender })),
  elevenlabs: ELEVENLABS_VOICES.map((v) => ({ id: v.id, name: v.name, tone: v.tone, gender: v.gender })),
  openai: OPENAI_CHARACTERS,
};

/** Voice picker popup: character cards with a face, tone and a play-a-sample button, grouped by provider. */
export function VoicePickerDialog({
  open,
  voice,
  settings,
  onClose,
  onPick,
}: {
  open: boolean;
  voice: Voice;
  settings: MaskedSettings | null;
  onClose: () => void;
  onPick: (patch: Partial<Voice>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [provider, setProvider] = useState<Provider>(voice.provider === "none" ? "typecast" : voice.provider);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function stop() {
    audio.current?.pause();
    setPlaying(null);
  }

  async function preview(c: Character) {
    if (playing === c.id) return stop();
    stop();
    setError(null);
    setLoading(c.id);
    const el = new Audio(`/api/voice-sample?provider=${provider}&voiceId=${encodeURIComponent(c.id)}`);
    audio.current = el;
    el.onended = () => setPlaying(null);
    el.onerror = () => {
      setLoading(null);
      setPlaying(null);
      setError("샘플을 만들지 못했어요. 설정에서 API 키를 확인해 주세요.");
    };
    el.oncanplay = () => setLoading(null);
    try {
      await el.play();
      setPlaying(c.id);
    } catch {
      setLoading(null);
    }
  }

  const keyReady = ttsReady(settings, provider);
  const list = CHARACTERS[provider];

  return (
    <dialog
      ref={ref}
      aria-labelledby="voice-picker-title"
      onClose={() => {
        stop();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      className="m-auto w-[min(100%-2rem,920px)] max-w-none overflow-hidden rounded-3xl border border-line bg-bg p-0 text-fg shadow-[0_40px_90px_-30px_rgb(15_23_42/0.5)] backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-5">
          <div>
            <h2 id="voice-picker-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
              나레이션 목소리 고르기
            </h2>
            <p className="mt-1 text-sm text-muted">▶를 누르면 같은 대본을 그 목소리로 읽어줘요. 처음 한 번만 만들고 그 뒤로는 바로 들려요.</p>
          </div>
          <button type="button" aria-label="닫기" onClick={() => ref.current?.close()} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
            ✕
          </button>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-line bg-surface px-6 py-3" role="tablist">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={provider === p.id}
              onClick={() => {
                stop();
                setProvider(p.id);
              }}
              className={cx(
                "flex shrink-0 flex-col items-start rounded-xl border px-3.5 py-2 text-left transition",
                provider === p.id ? "border-accent bg-accent/10" : "border-line hover:border-faint",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                {p.label}
                <span className={cx("size-1.5 rounded-full", ttsReady(settings, p.id) ? "bg-success" : "bg-faint")} />
              </span>
              <span className="text-[11px] text-muted">{p.note}</span>
            </button>
          ))}
        </nav>

        <div className="overflow-y-auto p-6">
          {!keyReady ? (
            <p className="mb-4 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">이 목소리를 쓰려면 설정(톱니바퀴)에서 API 키를 넣어주세요.</p>
          ) : null}
          {error ? <p className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((c) => {
              const selected = voice.provider === provider && (voice.voiceId || CHARACTERS[provider][0].id) === c.id;
              return (
                <div
                  key={c.id}
                  className={cx(
                    "flex flex-col items-center rounded-2xl border bg-surface p-4 text-center transition",
                    selected ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-faint",
                  )}
                >
                  <div className="relative">
                    <VoiceAvatar seed={c.id} gender={c.gender} size={84} />
                    {playing === c.id ? (
                      <span className="absolute -right-1 -bottom-1 flex h-6 items-end gap-[2px] rounded-full bg-accent px-1.5 pb-1.5">
                        {[0, 1, 2].map((k) => (
                          <span key={k} className="ai-wave w-[3px] rounded-full bg-white" style={{ animationDelay: `${k * 120}ms` }} />
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-base font-bold">{c.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{c.tone}</p>
                  <div className="mt-3 flex w-full gap-1.5">
                    <button
                      type="button"
                      onClick={() => void preview(c)}
                      disabled={!keyReady}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line py-1.5 text-xs font-semibold hover:border-accent disabled:opacity-40"
                    >
                      {loading === c.id ? <Spinner className="size-3" /> : playing === c.id ? "■ 정지" : "▶ 들어보기"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onPick({ provider, voiceId: c.id });
                        ref.current?.close();
                      }}
                      className={cx(
                        "flex-1 rounded-lg py-1.5 text-xs font-bold",
                        selected ? "bg-success/10 text-success" : "bg-accent text-white hover:bg-accent-strong",
                      )}
                    >
                      {selected ? "사용 중" : "선택"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </dialog>
  );
}
