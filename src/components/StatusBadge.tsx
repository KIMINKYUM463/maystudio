import type { Project } from "@/lib/types";
import { Badge, type BadgeTone } from "./ui";

const STATUS: Record<Project["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "작성 중", tone: "neutral" },
  scripted: { label: "대본 완료", tone: "accent" },
  rendering: { label: "렌더링 중", tone: "warning" },
  done: { label: "영상 완성", tone: "success" },
  error: { label: "렌더 실패", tone: "danger" },
};

export function StatusBadge({ status }: { status: Project["status"] }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
