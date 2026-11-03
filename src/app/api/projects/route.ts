import { buildCopy, hookLineFor } from "@/lib/script/copy";
import { swapHook } from "@/lib/script/generator";
import { HOOK_ANGLE_LABELS } from "@/lib/script/hooks";
import { createDemoProject } from "@/lib/server/demo";
import { BadRequestError, readJsonBody, route } from "@/lib/server/http";
import { createProject, duplicateProject, getClicks, getSettings, listProjects, saveProject } from "@/lib/server/store";
import { findIdea, IDEA_THEMES, productFromIdea } from "@/lib/stay-ideas";
import type { Project } from "@/lib/types";
import { z } from "zod";

export const GET = route(async () => {
  const [projects, clicks] = await Promise.all([listProjects(), getClicks()]);
  return Response.json({
    projects: projects.map((p) => ({ ...p, clicks: clicks[p.id]?.total ?? 0 })),
  });
});

const createSchema = z.object({
  demo: z.boolean().optional(),
  /** Prefill from one of the kit's stay ideas (`STAY_IDEAS`). */
  ideaId: z.string().max(40).optional(),
  /** Copy an existing project with a different hook (kit: re-upload with only the first line changed). */
  duplicateOf: z.string().max(40).optional(),
});

function withNewHook(project: Project): Project {
  const { hookAngle, scenes } = swapHook(project);
  const hookLine = hookLineFor(scenes, project.style.template);
  return {
    ...project,
    hookAngle,
    scenes,
    title: `${project.title} · ${HOOK_ANGLE_LABELS[hookAngle].label}`.slice(0, 80),
    copy: hookLine ? buildCopy(project, hookLine, project.copy.commentKeyword) : project.copy,
  };
}

async function createFromIdea(ideaId: string): Promise<Project> {
  const idea = findIdea(ideaId);
  if (!idea) throw new BadRequestError("알 수 없는 숙소 아이디어입니다.");
  const theme = IDEA_THEMES[idea.theme];
  const project = await createProject(await getSettings());
  return saveProject({
    ...project,
    title: idea.name,
    hookAngle: theme.hookAngle,
    product: { ...project.product, ...productFromIdea(idea) },
    copy: { ...project.copy, commentKeyword: theme.keyword },
  });
}

export const POST = route(async (request: Request) => {
  const { demo, ideaId, duplicateOf } = createSchema.parse(await readJsonBody(request));
  const project = duplicateOf
    ? await duplicateProject(duplicateOf, withNewHook)
    : ideaId
      ? await createFromIdea(ideaId)
      : demo
        ? await createDemoProject()
        : await createProject(await getSettings());
  return Response.json({ project }, { status: 201 });
});
