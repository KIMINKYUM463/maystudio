import { deleteProjectFile, saveAudioFile } from "@/lib/server/assets";
import { BadRequestError, route } from "@/lib/server/http";
import { getProject, updateProject } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await getProject(id);
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) throw new BadRequestError("음악 파일을 선택하세요.");
  const saved = await saveAudioFile(id, Buffer.from(await file.arrayBuffer()), "bgm");
  await deleteProjectFile(id, project.style.bgmFile);
  const updated = await updateProject(id, (p) => ({ ...p, style: { ...p.style, bgmFile: saved } }));
  return Response.json({ project: updated }, { status: 201 });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await getProject(id);
  await deleteProjectFile(id, project.style.bgmFile);
  const updated = await updateProject(id, (p) => ({ ...p, style: { ...p.style, bgmFile: undefined } }));
  return Response.json({ project: updated });
});
