"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/toast";
import { StayRanking } from "@/components/StayRanking";
import { api, errorMessage } from "@/lib/client/api";
import type { Project } from "@/lib/types";
import { IdeaPicker } from "./IdeaPicker";

/** "숙소 추천" tab: the curated stay list, moved off the home screen. */
export function StayIdeasPage() {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);

  async function create(ideaId: string, json: Record<string, string> = { ideaId }) {
    setCreating(ideaId);
    try {
      const { project } = await api<{ project: Project }>("/api/projects", { method: "POST", json });
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setCreating(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <IdeaPicker creatingId={creating} onCreate={(id) => void create(id)} />
      <section className="mt-14">
        <p className="text-[13px] font-semibold text-accent">숙소 반응 랭킹</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-[-0.025em]">다른 채널에서 터진 숙소</h2>
        <p className="mt-2 mb-5 max-w-xl text-sm leading-relaxed text-muted">
          숙소 지도에 모인 릴스 반응을 숙소별로 줄 세웠어요. 고르면 숙소 정보가 채워진 새 숏폼이 열려요.
        </p>
        <StayRanking busy={creating} onPick={(stay) => void create(stay.name, { mapStay: stay.name })} />
      </section>
    </div>
  );
}
