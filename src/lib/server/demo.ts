import { buildCopy, hookLineFor } from "../script/copy";
import { scriptFor } from "../script/review";
import type { Project } from "../types";
import { saveImageAsset } from "./assets";
import { createProject, getSettings, saveProject } from "./store";

/** Free stock photos (picsum.photos serves Unsplash-licensed images). */
const DEMO_PHOTOS: Array<{ url: string; label: string }> = [
  { url: "https://picsum.photos/id/1040/1200/1600", label: "외관" },
  { url: "https://picsum.photos/id/164/1600/1067", label: "오션뷰" },
  { url: "https://picsum.photos/id/1048/1200/1600", label: "객실" },
  { url: "https://picsum.photos/id/1036/1600/1067", label: "테라스" },
  { url: "https://picsum.photos/id/1067/1200/1600", label: "야경" },
  { url: "https://picsum.photos/id/1018/1600/1067", label: "풍경" },
  { url: "https://picsum.photos/id/1080/1200/1600", label: "조식" },
  { url: "https://picsum.photos/id/1047/1200/1600", label: "전경" },
];

export async function createDemoProject(): Promise<Project> {
  const settings = await getSettings();
  const project = await createProject(settings);
  const assets = [];
  for (const photo of DEMO_PHOTOS) {
    const res = await fetch(photo.url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`샘플 이미지를 받지 못했습니다 (${res.status})`);
    assets.push(await saveImageAsset(project.id, Buffer.from(await res.arrayBuffer()), photo.label));
  }
  const next: Project = {
    ...project,
    title: "[샘플] 강릉 오션뷰 감성 스테이",
    hookAngle: "condition",
    assets,
    product: {
      ...project.product,
      name: "오션뷰 감성 스테이",
      region: "강원 강릉",
      priceText: "1박 89,000원~",
      originalPriceText: "129,000원",
      rating: "4.8",
      features: ["통창 오션뷰", "객실 전용 스파 욕조", "개별 바베큐", "무료 주차"],
      target: "커플",
      stayType: "펜션",
      access: "서울에서 2시간 반",
      occasion: "겨울 바다 여행",
      platform: "myrealtrip",
      affiliateUrl: "https://www.myrealtrip.com/",
    },
    copy: { ...project.copy, commentKeyword: "쉼" },
  };
  const { scenes } = scriptFor(next, 7);
  return saveProject({
    ...next,
    scenes,
    status: "scripted",
    copy: buildCopy(next, hookLineFor(scenes, next.style.template), next.copy.commentKeyword),
  });
}
