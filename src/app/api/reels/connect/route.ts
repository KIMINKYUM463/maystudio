import { BadRequestError, route } from "@/lib/server/http";
import { findIgUser } from "@/lib/server/reel-collector";
import { getSettings, saveSettings } from "@/lib/server/store";

/** 연결 확인: finds the Instagram professional account behind the saved token and stores its id. */
export const POST = route(async () => {
  const settings = await getSettings();
  if (!settings.metaToken) throw new BadRequestError("메타 연결 키를 먼저 저장해 주세요.");
  const ig = await findIgUser(settings.metaToken);
  await saveSettings({ ...settings, igUserId: ig.id });
  return Response.json(ig);
});
