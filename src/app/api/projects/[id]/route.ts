import { readJsonBody, route } from "@/lib/server/http";
import { deleteProject, getProject, updateProject } from "@/lib/server/store";
import { applyProjectPatch } from "@/lib/project-patch";
import { projectPatchSchema } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  return Response.json({ project: await getProject(id) });
});

export const PATCH = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const patch = projectPatchSchema.parse(await readJsonBody(request));
  const project = await updateProject(id, (p) => applyProjectPatch(p, patch));
  return Response.json({ project });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  await getProject(id);
  await deleteProject(id);
  return new Response(null, { status: 204 });
});
