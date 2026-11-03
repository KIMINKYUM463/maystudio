import { route } from "@/lib/server/http";
import { isRenderActive, startRender } from "@/lib/server/render-job";
import { getProject } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await startRender(id);
  return Response.json({ render: project.render }, { status: 202 });
});

export const GET = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await getProject(id);
  return Response.json({ render: project.render, active: isRenderActive(project), updatedAt: project.updatedAt });
});
