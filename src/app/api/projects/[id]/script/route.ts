import { buildCopy, hookLineFor } from "@/lib/script/copy";
import { applyTextOverrides } from "@/lib/script/generator";
import { refitReviewShots, scriptFor, shotSecFor } from "@/lib/script/review";
import { readJsonBody, route } from "@/lib/server/http";
import { blurNewFaces } from "@/lib/server/face-blur";
import { hasLlm, rewriteWithLlm } from "@/lib/server/llm";
import { addScenery, removeOldScenery } from "@/lib/server/scenery";
import { matchShotsByVision } from "@/lib/server/shot-match";
import { getProject, getSettings, nextLinkNumber, saveProject } from "@/lib/server/store";
import { clearNarration } from "@/lib/server/tts";
import { hookAngleSchema } from "@/lib/types";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({
  useAi: z.boolean().default(true),
  hookAngle: hookAngleSchema.optional(),
  seed: z.number().int().optional(),
});

export const POST = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = bodySchema.parse(await readJsonBody(request));
  const [current, settings] = await Promise.all([getProject(id), getSettings()]);
  const keyword = current.copy.commentKeyword || settings.defaultCommentKeyword || "숙소";
  const linkNumber = current.copy.linkNumber ?? (current.style.template === "review" ? await nextLinkNumber() : undefined);
  const project = {
    ...current,
    hookAngle: body.hookAngle ?? current.hookAngle,
    copy: { ...current.copy, commentKeyword: keyword, linkNumber },
  };

  let { scenes } = scriptFor(project, body.seed);
  let source: "ai" | "template" = "template";
  let warning: string | undefined;
  let aiHashtags: string[] = [];

  if (body.useAi && hasLlm(settings)) {
    try {
      const result = await rewriteWithLlm(project, scenes, settings);
      scenes = applyTextOverrides(scenes, result.overrides);
      if (project.style.template === "review") {
        scenes = refitReviewShots(scenes, project.assets, shotSecFor(project.style));
      }
      aiHashtags = result.hashtags;
      source = "ai";
    } catch (error) {
      warning = `AI 대본 생성에 실패해 템플릿 대본을 사용했습니다. (${error instanceof Error ? error.message : "알 수 없는 오류"})`;
    }
  }

  // Which photo shows on which line: by what the photos show (vision AI), not by their names.
  try {
    scenes = await matchShotsByVision(project, scenes, settings);
  } catch (error) {
    console.error("[shots]", error);
  }

  // Free scenery that fits the lines, swapped fresh on every regeneration (never blocks the script).
  let assets = project.assets;
  ({ assets, scenes } = await removeOldScenery(id, assets, scenes));
  if (project.style.autoScenery) {
    try {
      ({ assets, scenes } = await addScenery(id, { ...project, assets }, scenes, settings));
    } catch (error) {
      console.error("[scenery]", error);
    }
  }

  const copy = buildCopy({ ...project, assets, scenes }, hookLineFor(scenes, project.style.template), keyword);
  if (aiHashtags.length) {
    copy.caption = copy.caption.replace(copy.hashtags.map((t) => `#${t}`).join(" "), aiHashtags.map((t) => `#${t}`).join(" "));
    copy.hashtags = aiHashtags;
  }

  const cleared = await clearNarration(project);
  let saved = await saveProject({
    ...cleared,
    assets,
    scenes,
    copy,
    status: cleared.status === "draft" ? "scripted" : cleared.status,
  });
  // Scenery can show people too: same mosaic as the stay's own photos.
  if (saved.assets.some((a) => a.scenery && !a.faceChecked)) {
    try {
      ({ project: saved } = await blurNewFaces(id));
    } catch (error) {
      console.error("[faces]", error);
    }
  }
  return Response.json({ project: saved, source, warning });
});
