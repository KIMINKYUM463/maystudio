import { deleteDataFile, deleteProjectFile, saveLogo } from "@/lib/server/assets";
import { BadRequestError, route } from "@/lib/server/http";
import { getProject, getSettings, saveSettings, updateProject } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

/** The channel logo is a brand setting: uploading it here also makes it the default for new projects. */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const [project, settings] = await Promise.all([getProject(id), getSettings()]);
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) throw new BadRequestError("로고 이미지를 선택하세요.");
  const saved = await saveLogo(id, Buffer.from(await file.arrayBuffer()));
  await Promise.all([deleteProjectFile(id, project.style.logoFile), deleteDataFile(settings.brandLogoFile)]);
  await saveSettings({ ...settings, brandLogoFile: saved.brandFile });
  const updated = await updateProject(id, (p) => ({ ...p, style: { ...p.style, logoFile: saved.file } }));
  return Response.json({ project: updated }, { status: 201 });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const [project, settings] = await Promise.all([getProject(id), getSettings()]);
  await Promise.all([deleteProjectFile(id, project.style.logoFile), deleteDataFile(settings.brandLogoFile)]);
  await saveSettings({ ...settings, brandLogoFile: undefined });
  const updated = await updateProject(id, (p) => ({ ...p, style: { ...p.style, logoFile: undefined } }));
  return Response.json({ project: updated });
});
