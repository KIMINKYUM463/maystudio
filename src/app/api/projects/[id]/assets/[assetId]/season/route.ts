import { route } from "@/lib/server/http";
import { pollSeasonImage, startSeasonImage, undoSeasonImage } from "@/lib/server/season-asset";

type Ctx = { params: Promise<{ id: string; assetId: string }> };

/** Starts an AI season image for this photo (photo → seasonal 9:16 image, before the AI clip). */
export const POST = route(async (_request: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  return Response.json(await startSeasonImage(id, assetId), { status: 202 });
});

/** Polls the job and swaps the photo for the season image when Replicate finishes. */
export const GET = route(async (_request: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  return Response.json(await pollSeasonImage(id, assetId));
});

/** Puts the original photo back. */
export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  return Response.json({ project: await undoSeasonImage(id, assetId) });
});
