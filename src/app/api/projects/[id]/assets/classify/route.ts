import { applyPhotoClasses, featuresFromPhotos, groupCounts } from "@/lib/photo-groups";
import { route } from "@/lib/server/http";
import { classifyPhotos } from "@/lib/server/photo-classify";
import { getProject, getSettings, updateProject } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

/** AI looks at every photo, names it and sorts water → signature → room → other (best first). */
export const POST = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const [project, settings] = await Promise.all([getProject(id), getSettings()]);
  const classes = await classifyPhotos(project, settings);
  // Re-read inside the update so an upload that landed during the AI call is not lost.
  const updated = await updateProject(id, (p) => {
    const sameAssets = p.assets.length === project.assets.length && p.assets.every((a, i) => a.id === project.assets[i].id);
    if (!sameAssets) return p;
    const assets = applyPhotoClasses(p.assets, classes);
    return { ...p, assets, product: { ...p.product, features: featuresFromPhotos(p.product.features, assets) } };
  });
  return Response.json({ project: updated, counts: groupCounts(classes) });
});
