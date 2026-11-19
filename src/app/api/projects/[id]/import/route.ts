import { BadRequestError, readJsonBody, route } from "@/lib/server/http";
import { blurNewFaces } from "@/lib/server/face-blur";
import { downloadImages, fetchProductPage } from "@/lib/server/importer";
import { getProject, updateProject } from "@/lib/server/store";
import { MAX_ASSETS } from "@/lib/types";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({
  url: z.string().min(1),
  withImages: z.boolean().default(true),
  /** Also the best review's guest photos (Coupang). */
  withReviewPhotos: z.boolean().default(true),
});

/** Listings name the same stay differently ("니지모리 스튜디오" vs "동두천 니지모리스튜디오 료칸"). */
function sameStayName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]·&.,-]/g, "");
  const [x, y] = [norm(a), norm(b)];
  return x.includes(y) || y.includes(x);
}

export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { url, withImages, withReviewPhotos } = bodySchema.parse(await readJsonBody(request));
  const project = await getProject(id);
  let result;
  try {
    result = await fetchProductPage(url);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "페이지를 가져오지 못했습니다.");
  }
  const slots = Math.max(0, MAX_ASSETS - project.assets.length);
  // Review photos are few (≤6) and the point of asking for them, so their slots are kept first.
  const reviewWanted = withImages && withReviewPhotos ? Math.min(result.reviewImages?.length ?? 0, slots) : 0;
  const listing = withImages ? await downloadImages(id, result.images, slots - reviewWanted) : [];
  const reviews = reviewWanted
    ? (await downloadImages(id, result.reviewImages!, slots - listing.length)).map((a) => ({ ...a, fromReview: true }))
    : [];
  const assets = [...listing, ...reviews];

  // Only fill fields the user hasn't typed yet.
  const filled = Object.fromEntries(
    Object.entries(result.product).filter(([key, value]) => {
      const current = project.product[key as keyof typeof project.product];
      return value && (!current || (Array.isArray(current) && current.length === 0) || key === "sourceUrl" || key === "platform");
    }),
  );
  let updated = await updateProject(id, (p) => ({
    ...p,
    title: p.title === "새 여행 숏폼" && result.product.name ? result.product.name : p.title,
    product: { ...p.product, ...filled },
    assets: [...p.assets, ...assets],
  }));
  // Listing photos often show models: mosaic their faces right away (needs a Gemini/OpenAI key; never blocks the import).
  let blurred = 0;
  if (assets.length) {
    try {
      ({ project: updated, blurred } = await blurNewFaces(id));
    } catch (error) {
      console.error("[faces]", error);
    }
  }
  const pageName = result.product.name ?? "";
  const typedName = project.product.name;
  return Response.json({
    project: updated,
    imported: {
      fields: Object.keys(filled),
      images: assets.length,
      reviewImages: reviews.length,
      blurred,
      foundImages: result.images.length,
      // Set when the page is a different stay than the one already typed (e.g. a prefilled kit idea).
      otherName: pageName && typedName && !sameStayName(pageName, typedName) ? pageName : null,
    },
  });
});
