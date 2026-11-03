import { createEmptyProject } from "@/lib/project-factory";
import type { Asset, Project } from "@/lib/types";

export function asset(id: string, label: string, width = 1200, height = 1600): Asset {
  return { id, file: `assets/${id}.jpg`, label, width, height };
}

export function sampleProject(overrides: Partial<Project> = {}): Project {
  const base = createEmptyProject("TestProj01", "2026-11-03T00:00:00.000Z");
  return {
    ...base,
    product: {
      ...base.product,
      name: "오션뷰 감성 스테이",
      region: "강원 강릉",
      priceText: "1박 89,000원~",
      originalPriceText: "129,000원",
      rating: "4.8",
      features: ["개별 바베큐", "통창 오션뷰", "스파 욕조"],
      target: "커플",
    },
    assets: [
      asset("a1", "외관"),
      asset("a2", "오션뷰", 1600, 1067),
      asset("a3", "객실"),
      asset("a4", "욕실"),
      asset("a5", "야경", 1600, 1067),
    ],
    ...overrides,
  };
}
