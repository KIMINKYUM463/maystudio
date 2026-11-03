import { SECRET_SETTING_KEYS, type Settings, type Voice } from "./types";

export const MASK = "••••";

export type SecretKey = (typeof SECRET_SETTING_KEYS)[number];
export type MaskedSettings = Settings & { configured: Record<SecretKey, boolean> };

export function maskSecret(value: string): string {
  if (!value) return "";
  return value.length <= 8 ? MASK : `${value.slice(0, 3)}${MASK}${value.slice(-4)}`;
}

export function maskSettings(settings: Settings): MaskedSettings {
  const masked = { ...settings } as MaskedSettings;
  masked.configured = {} as Record<SecretKey, boolean>;
  for (const key of SECRET_SETTING_KEYS) {
    masked.configured[key] = Boolean(settings[key]);
    masked[key] = maskSecret(settings[key]);
  }
  return masked;
}

const LLM_KEY: Record<Settings["llmProvider"], SecretKey | null> = {
  none: null,
  openai: "openaiKey",
  anthropic: "anthropicKey",
  gemini: "geminiKey",
};
const TTS_KEY: Record<Voice["provider"], SecretKey | null> = {
  none: null,
  openai: "openaiKey",
  elevenlabs: "elevenlabsKey",
};

export function llmReady(settings: MaskedSettings | null): boolean {
  const key = settings && LLM_KEY[settings.llmProvider];
  return Boolean(key && settings.configured[key]);
}

export function ttsReady(settings: MaskedSettings | null, provider: Voice["provider"]): boolean {
  const key = TTS_KEY[provider];
  return Boolean(settings && key && settings.configured[key]);
}

export function replicateReady(settings: MaskedSettings | null): boolean {
  return Boolean(settings?.configured.replicateKey);
}

/** Secrets: undefined or an echoed mask keeps the stored key; "" clears it. */
export function mergeSettings(current: Settings, patch: Partial<Settings>): Settings {
  const next: Settings = { ...current, ...patch };
  for (const key of SECRET_SETTING_KEYS) {
    const value = patch[key];
    next[key] = value === undefined || value.includes(MASK) ? current[key] : value.trim();
  }
  return next;
}
