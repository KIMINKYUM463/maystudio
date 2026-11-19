import { z } from "zod";
import { listCatalog, saveToCatalog } from "@/lib/server/catalog";
import { BadRequestError, readJsonBody, route } from "@/lib/server/http";

export const GET = route(async () => Response.json({ stays: await listCatalog() }));

const saveSchema = z.object({ projectId: z.string().min(1), ideaId: z.string().min(1) });

/** Stores a project's sorted photos and facts as the ready-made entry for a recommended stay. */
export const POST = route(async (request: Request) => {
  const { projectId, ideaId } = saveSchema.parse(await readJsonBody(request));
  try {
    return Response.json({ stay: await saveToCatalog(projectId, ideaId) });
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "저장하지 못했어요.");
  }
});
