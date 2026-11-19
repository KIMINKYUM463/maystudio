import { route } from "@/lib/server/http";
import { collectReels, loadReelStore } from "@/lib/server/reel-collector";

function status(store: Awaited<ReturnType<typeof loadReelStore>>) {
  return {
    reels: Object.keys(store.reels).length,
    runs: store.runs,
    lastRun: store.lastRun ?? null,
    lastError: store.lastError ?? null,
    failed: store.failed ?? [],
  };
}

export const GET = route(async () => Response.json(status(await loadReelStore())));

/** 지금 수집: runs once over every watched account. */
export const POST = route(async () => Response.json(status(await collectReels())));
