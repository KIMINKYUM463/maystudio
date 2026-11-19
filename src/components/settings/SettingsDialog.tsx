"use client";

import { useEffect, useRef, useState } from "react";
import type { MaskedSettings } from "@/lib/settings-view";
import { SettingsForm } from "./SettingsForm";

const OPEN_EVENT = "maystudio:open-settings";
/** Fired after a successful save so open screens (e.g. the editor) pick up new keys without a reload. */
export const SETTINGS_SAVED_EVENT = "maystudio:settings-saved";

export function openSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function announceSettingsSaved(settings: MaskedSettings) {
  window.dispatchEvent(new CustomEvent<MaskedSettings>(SETTINGS_SAVED_EVENT, { detail: settings }));
}

/** App-wide settings popup; mounted once in the root layout and opened from the header gear or inline links. */
export function SettingsDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => {
      setOpen(true);
      ref.current?.showModal();
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="settings-title"
      onClose={() => setOpen(false)}
      // A click that lands on the dialog element itself is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      className="m-auto w-[min(100%-2rem,760px)] max-w-none overflow-hidden rounded-2xl border border-line bg-bg p-0 text-fg shadow-[0_32px_80px_-24px_rgb(15_23_42/0.45)] backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <GearIcon size={18} />
            </span>
            <div>
              <h2 id="settings-title" className="text-lg font-bold tracking-[-0.015em]">
                설정
              </h2>
              <p className="mt-0.5 text-sm text-muted">AI 대본·음성 키와 채널 기본값을 관리해요. 키 없이도 모든 기능을 쓸 수 있어요.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="설정 닫기"
            onClick={() => ref.current?.close()}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="overflow-y-auto p-6">{open ? <SettingsForm /> : null}</div>
      </div>
    </dialog>
  );
}

export function GearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
