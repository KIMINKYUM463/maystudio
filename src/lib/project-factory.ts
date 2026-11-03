import {
  copySchema,
  productSchema,
  projectSchema,
  styleSchema,
  voiceSchema,
  type Project,
  type Settings,
} from "./types";

export function createEmptyProject(
  id: string,
  nowIso: string,
  defaults: Partial<Settings> = {},
): Project {
  return projectSchema.parse({
    id,
    title: "새 여행 숏폼",
    createdAt: nowIso,
    updatedAt: nowIso,
    status: "draft",
    hookAngle: "condition",
    product: productSchema.parse({}),
    assets: [],
    scenes: [],
    style: styleSchema.parse({ watermark: defaults.instagramHandle ?? "" }),
    voice: voiceSchema.parse({}),
    copy: copySchema.parse({ commentKeyword: defaults.defaultCommentKeyword ?? "숙소" }),
    render: { status: "idle", progress: 0 },
  });
}
