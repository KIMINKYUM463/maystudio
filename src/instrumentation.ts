/** Starts the reel collector loop with the server: checks hourly, collects at the interval set in settings. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { collectIfDue } = await import("./lib/server/reel-collector");
  const tick = () => void collectIfDue().catch((error) => console.error("[reels]", error));
  setTimeout(tick, 30_000);
  setInterval(tick, 3_600_000);
}
