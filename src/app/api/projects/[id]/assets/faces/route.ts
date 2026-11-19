import { readJsonBody, route } from "@/lib/server/http";
import { blurNewFaces, restoreOriginal } from "@/lib/server/face-blur";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ restore: z.string().optional() });

/** 인물 모자이크: mosaic faces in photos not checked yet, or { restore: assetId } to undo one. */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { restore } = bodySchema.parse(await readJsonBody(request).catch(() => ({})));
  if (restore) return Response.json({ project: await restoreOriginal(id, restore), blurred: 0 });
  return Response.json(await blurNewFaces(id));
});
