import { assertPublicHttpUrl, parseProductHtml, type ImportedImage, type ImportResult } from "../import-parser";
import type { Asset } from "../types";
import { saveImageAsset } from "./assets";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
};

export async function fetchProductPage(rawUrl: string): Promise<ImportResult> {
  const url = assertPublicHttpUrl(rawUrl);
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`페이지를 불러오지 못했습니다 (${res.status}). 정보를 직접 입력해 주세요.`);
  assertPublicHttpUrl(res.url || url.toString());
  const html = (await res.text()).slice(0, 3_000_000);
  return parseProductHtml(html, res.url || url.toString());
}

const DOWNLOAD_CONCURRENCY = 4;

async function downloadImage(projectId: string, image: ImportedImage): Promise<Asset | null> {
  try {
    const url = assertPublicHttpUrl(image.url);
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return await saveImageAsset(projectId, Buffer.from(await res.arrayBuffer()), image.label);
  } catch {
    // Skip images that fail to download or decode so one bad URL doesn't abort the import.
    return null;
  }
}

/** Downloads up to `limit` images in page order, a few at a time. */
export async function downloadImages(projectId: string, images: ImportedImage[], limit: number): Promise<Asset[]> {
  const assets: Asset[] = [];
  let next = 0;
  while (next < images.length && assets.length < limit) {
    // Never start more downloads than slots left, so no file is saved and then dropped.
    const size = Math.min(DOWNLOAD_CONCURRENCY, limit - assets.length);
    const batch = await Promise.all(images.slice(next, next + size).map((img) => downloadImage(projectId, img)));
    next += size;
    assets.push(...batch.filter((a): a is Asset => a !== null));
  }
  return assets;
}
