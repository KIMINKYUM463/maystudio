import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata: Metadata = { title: "설정 · MayStudio" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-extrabold">설정</h1>
      <p className="mt-2 mb-6 text-sm text-muted">AI 대본·음성 키와 채널 기본값을 관리해요. 키 없이도 모든 기능을 쓸 수 있어요.</p>
      <SettingsForm />
    </div>
  );
}
