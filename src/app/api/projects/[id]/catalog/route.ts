import { z } from "zod";
import { applyCatalog } from "@/lib/server/catalog";
import { BadRequestError, readJsonBody, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ ideaId: z.string().min(1) });

/** Fills the project with a recommended stay's photos and facts. */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { ideaId } = bodySchema.parse(await readJsonBody(request));
  try {
    return Response.json({ project: await applyCatalog(id, ideaId) });
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "숙소를 가져오지 못했어요.");
  }
});
