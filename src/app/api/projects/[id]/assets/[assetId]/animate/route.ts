import { pollAssetAnimate, startAssetAnimate } from "@/lib/server/animate-asset";
import { readJsonBody, route } from "@/lib/server/http";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string; assetId: string }> };

const bodySchema = z.object({
  promptType: z.string().max(20).optional(),
  withPeople: z.boolean().optional(),
});

/** Starts a Replicate image-to-video job for this photo (Flow replacement). */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  const body = bodySchema.parse((await readJsonBody(request).catch(() => ({}))) ?? {});
  return Response.json(await startAssetAnimate(id, assetId, body), { status: 202 });
});

/** Polls the in-flight job and attaches the mp4 when Replicate finishes. */
export const GET = route(async (_request: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  return Response.json(await pollAssetAnimate(id, assetId));
});
