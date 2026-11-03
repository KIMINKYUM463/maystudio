import { getProject, isValidId, recordClick } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string }> };

/** Short link for DMs/bio: counts the click, then redirects to the affiliate URL. */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isValidId(id)) return new Response("Not found", { status: 404 });
  let target: string;
  try {
    target = (await getProject(id)).product.affiliateUrl;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!/^https?:\/\//i.test(target)) return new Response("링크가 아직 등록되지 않았습니다.", { status: 404 });
  await recordClick(id).catch((error) => console.error("click log failed", error));
  return Response.redirect(target, 302);
}
