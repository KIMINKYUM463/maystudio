import { route } from "@/lib/server/http";
import { hotFeed } from "@/lib/server/reel-collector";

/** The map's 오늘 터진 릴스 tab reads this; empty items = keep the map's built-in snapshot. */
export const GET = route(async () => Response.json(await hotFeed()));
