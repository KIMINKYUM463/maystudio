import { deleteProjectFile, MAX_VIDEO_BYTES, saveImageAsset, saveVideoClip } from "@/lib/server/assets";
import { BadRequestError, route } from "@/lib/server/http";
import { getProject, updateProject } from "@/lib/server/store";
import { MAX_ASSETS, type Asset } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function labelFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  // Camera/messenger/generator filenames ("IMG_1234", "flow_video_…") make useless labels.
  return /^(img|dsc|pxl|photo|kakaotalk|screenshot|image|video|vid|flow|veo)[\s_-]?\d*/i.test(base)
    ? ""
    : base.replace(/[_-]+/g, " ").slice(0, 30);
}

const asFile = (v: FormDataEntryValue | null): File | null => (v instanceof File && v.size > 0 ? v : null);

/** A clip (e.g. made in Google Flow) plus its poster frame, stored as one photo that plays as video. */
async function saveVideoAsset(id: string, video: File, poster: File): Promise<Asset> {
  if (video.size > MAX_VIDEO_BYTES) throw new BadRequestError("영상은 100MB 이하만 가능합니다.");
  const asset = await saveImageAsset(id, Buffer.from(await poster.arrayBuffer()), labelFromFilename(video.name));
  try {
    return { ...asset, videoFile: await saveVideoClip(id, asset.id, Buffer.from(await video.arrayBuffer())) };
  } catch (error) {
    await deleteProjectFile(id, asset.file);
    throw error;
  }
}

/** multipart/form-data: one or more image `files`, or one `video` with its `poster` frame. */
export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await getProject(id);
  const form = await request.formData();
  const video = asFile(form.get("video"));
  const files = form.getAll("files").map(asFile).filter((f): f is File => f !== null);
  const count = files.length + (video ? 1 : 0);
  if (count === 0) throw new BadRequestError("업로드할 사진이나 영상이 없습니다.");
  if (project.assets.length + count > MAX_ASSETS) {
    throw new BadRequestError(`사진·영상은 합쳐서 최대 ${MAX_ASSETS}개까지 가능합니다.`);
  }
  const saved: Asset[] = [];
  if (video) {
    const poster = asFile(form.get("poster"));
    if (!poster) throw new BadRequestError("영상의 대표 사진(poster)이 필요합니다.");
    saved.push(await saveVideoAsset(id, video, poster));
  }
  for (const file of files) {
    saved.push(await saveImageAsset(id, Buffer.from(await file.arrayBuffer()), labelFromFilename(file.name)));
  }
  const updated = await updateProject(id, (p) => ({ ...p, assets: [...p.assets, ...saved] }));
  return Response.json({ project: updated }, { status: 201 });
});

export const DELETE = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId) throw new BadRequestError("assetId가 필요합니다.");
  const project = await getProject(id);
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) throw new BadRequestError("사진을 찾을 수 없습니다.");
  await Promise.all([deleteProjectFile(id, asset.file), deleteProjectFile(id, asset.videoFile)]);
  const updated = await updateProject(id, (p) => ({
    ...p,
    assets: p.assets.filter((a) => a.id !== assetId),
    scenes: p.scenes.map((s) => ({
      ...s,
      assetId: s.assetId === assetId ? null : s.assetId,
      extraAssetIds: s.extraAssetIds.filter((x) => x !== assetId),
    })),
  }));
  return Response.json({ project: updated });
});
