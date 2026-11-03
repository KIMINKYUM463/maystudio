import { readJsonBody, route } from "@/lib/server/http";
import { getSettings, saveSettings } from "@/lib/server/store";
import { maskSettings, mergeSettings } from "@/lib/settings-view";
import { patchOf, settingsSchema } from "@/lib/types";

export const GET = route(async () => Response.json({ settings: maskSettings(await getSettings()) }));

/** Secret fields: omitted = keep, "" = clear, other = replace. */
export const PUT = route(async (request: Request) => {
  // brandLogoFile is written only by the logo upload route.
  const patch = patchOf(settingsSchema.omit({ brandLogoFile: true })).parse(await readJsonBody(request));
  const saved = await saveSettings(mergeSettings(await getSettings(), patch));
  return Response.json({ settings: maskSettings(saved) });
});
