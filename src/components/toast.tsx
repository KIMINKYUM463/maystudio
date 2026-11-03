"use client";

import { useSyncExternalStore } from "react";
import { cx } from "./ui";

type Tone = "success" | "error" | "info";
type ToastItem = { id: number; tone: Tone; message: string };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function push(tone: Tone, message: string) {
  const id = nextId++;
  items = [...items, { id, tone, message }].slice(-4);
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 7000 : 3500);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Module-level toast store so any component (or async handler) can notify without context plumbing. */
export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

const EMPTY: ToastItem[] = [];

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const TONE_CLASS: Record<Tone, string> = {
  success: "border-success/40",
  error: "border-danger/50",
  info: "border-line",
};
const TONE_ICON: Record<Tone, string> = { success: "✓", error: "!", info: "i" };

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cx(
            "pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border bg-surface-2/95 px-4 py-3 text-left text-sm text-fg shadow-2xl backdrop-blur",
            TONE_CLASS[t.tone],
          )}
        >
          <span
            className={cx(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              t.tone === "error" ? "bg-danger text-white" : t.tone === "success" ? "bg-success text-black" : "bg-surface-3",
            )}
          >
            {TONE_ICON[t.tone]}
          </span>
          <span className="whitespace-pre-line">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
