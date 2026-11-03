import { deleteProjectFile, MAX_VIDEO_BYTES, saveVideoClip } from "@/lib/server/assets";
import { BadRequestError, route } from "@/lib/server/http";
import { getProject, updateProject } from "@/lib/server/store";
import type { Project } from "@/lib/types";

type Ctx = { params: Promise<{ id: string; assetId: string }> };

async function setClip(id: string, assetId: string, videoFile: string | undefined): Promise<Project> {
  let previous: string | undefined;
  const updated = await updateProject(id, (p) => {
    const asset = p.assets.find((a) => a.id === assetId);
    if (!asset) throw new BadRequestError("사진을 찾을 수 없습니다.");
    previous = asset.videoFile;
    return { ...p, assets: p.assets.map((a) => (a.id === assetId ? { ...a, videoFile, animateJobId: undefined } : a)) };
  });
  if (previous && previous !== videoFile) await deleteProjectFile(id, previous);
  return updated;
}

/** multipart/form-data `file`: an AI image-to-video clip that replaces this photo in the video. */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  const project = await getProject(id);
  if (!project.assets.some((a) => a.id === assetId)) throw new BadRequestError("사진을 찾을 수 없습니다.");
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) throw new BadRequestError("업로드할 영상이 없습니다.");
  if (file.size > MAX_VIDEO_BYTES) throw new BadRequestError("영상 클립은 100MB 이하만 가능합니다.");
  const videoFile = await saveVideoClip(id, assetId, Buffer.from(await file.arrayBuffer()));
  try {
    return Response.json({ project: await setClip(id, assetId, videoFile) }, { status: 201 });
  } catch (error) {
    await deleteProjectFile(id, videoFile);
    throw error;
  }
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { id, assetId } = await params;
  return Response.json({ project: await setClip(id, assetId, undefined) });
});
