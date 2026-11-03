import { BadRequestError, route } from "@/lib/server/http";
import { getProject, getSettings, saveProject } from "@/lib/server/store";
import { clearNarration, generateNarration, ttsKeyFor } from "@/lib/server/tts";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const [project, settings] = await Promise.all([getProject(id), getSettings()]);
  if (project.voice.provider === "none") throw new BadRequestError("음성 제공자를 먼저 선택하세요.");
  if (!ttsKeyFor(project.voice, settings)) {
    throw new BadRequestError("음성 API 키가 없습니다. 설정 화면에서 키를 입력하세요.");
  }
  if (project.scenes.length === 0) throw new BadRequestError("대본이 없습니다. 먼저 대본을 생성하세요.");
  let next;
  try {
    next = await generateNarration(project, settings);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "음성 생성에 실패했습니다.");
  }
  return Response.json({ project: await saveProject(next) });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await getProject(id);
  return Response.json({ project: await saveProject(await clearNarration(project)) });
});
