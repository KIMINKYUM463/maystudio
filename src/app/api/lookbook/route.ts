import { route } from "@/lib/server/http";
import { lookbookPhotos } from "@/lib/server/lookbook";
import { listProjects } from "@/lib/server/store";

/** Deduplicated stay photos for the home lookbook strip. */
export const GET = route(async () => Response.json({ photos: await lookbookPhotos(await listProjects()) }));
