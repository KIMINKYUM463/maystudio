"use client";

import { useState } from "react";
import { announceSettingsSaved } from "@/components/settings/SettingsDialog";
import { toast } from "@/components/toast";
import { Button, Card, SectionTitle } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import type { MaskedSettings } from "@/lib/settings-view";
import type { Project } from "@/lib/types";

/**
 * "내 설정으로 고정": the look (subtitle font/position, (광고), watermark, music, template…) and voice of this
 * project become the starting point of every new project, so the side settings stop needing a redo each time.
 */
export function DefaultsCard({ project, settings }: { project: Project; settings: MaskedSettings | null }) {
  const [saving, setSaving] = useState<"save" | "clear" | null>(null);
  const saved = Boolean(settings?.projectDefaults);

  async function save(clear: boolean) {
    setSaving(clear ? "clear" : "save");
    try {
      // Upload-managed files stay per project; everything else in style/voice is copied.
      const style = { ...project.style };
      delete style.bgmFile;
      delete style.logoFile;
      const { settings: next } = await api<{ settings: MaskedSettings }>("/api/settings", {
        method: "PUT",
        json: { projectDefaults: clear ? null : { style, voice: project.voice } },
      });
      announceSettingsSaved(next);
      toast.success(clear ? "기본값을 지웠어요. 새 프로젝트는 처음 설정으로 시작해요." : "이제 새 프로젝트가 이 설정으로 시작해요.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <SectionTitle
        title="내 설정으로 고정"
        description="자막 글자체·위치, (광고) 표시, 워터마크, 음악·효과음, 템플릿, 음성(목소리·속도)을 지금 이 프로젝트 그대로 새 프로젝트의 기본값으로 저장해요. 이미 만든 프로젝트는 바뀌지 않아요."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void save(false)} loading={saving === "save"} disabled={saving !== null}>
          {saved ? "지금 설정으로 기본값 바꾸기" : "지금 설정을 기본값으로 저장"}
        </Button>
        {saved ? (
          <Button variant="ghost" onClick={() => void save(true)} loading={saving === "clear"} disabled={saving !== null}>
            기본값 지우기
          </Button>
        ) : null}
        <span className="text-xs text-faint">{saved ? "저장된 기본값이 있어요." : "아직 저장된 기본값이 없어요."}</span>
      </div>
    </Card>
  );
}
