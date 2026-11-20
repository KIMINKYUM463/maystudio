"use client";

import { openSettings } from "@/components/settings/SettingsDialog";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "@/components/toast";
import { Button, Card, Field, inputClass, SectionTitle, cx } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { videoPoster } from "@/lib/client/video-poster";
import { planMediaUpload } from "@/lib/media-pair";
import { animateTargets, type PhotoGroup } from "@/lib/photo-groups";
import { quoteFromNotes } from "@/lib/review-quote";
import { CLIP_COST_USD, DEFAULT_REPLICATE_MODEL, KRW_PER_USD, SEASON_IMAGE_COST_USD } from "@/lib/replicate-models";
import { resolveSeason, SEASON_LABELS } from "@/lib/script/season-prompts";
import { replicateReady, visionReady } from "@/lib/settings-view";
import { CATEGORIES, MAX_ASSETS, SEASONS, type Category, type Product, type Project, type Season } from "@/lib/types";
import { ANIMATE_POLL_MS, animatePath, AssetVideoClip, VIDEO_ACCEPT, waitForAnimate, type AnimateResult } from "./AssetVideoClip";
import type { StepProps } from "./useProjectEditor";

type SeasonResult = { project: Project; status: "starting" | "processing" | "succeeded" | "failed"; error?: string };

const seasonPath = (projectId: string, assetId: string) => `/api/projects/${projectId}/assets/${assetId}/season`;

async function waitForSeason(editor: StepProps["editor"], projectId: string, assetId: string): Promise<SeasonResult> {
  while (true) {
    const result = await editor.run(() => api<SeasonResult>(seasonPath(projectId, assetId)));
    if (result.status === "succeeded") return result;
    if (result.status === "failed") throw new Error(result.error || "계절 이미지 만들기가 실패했어요.");
    await new Promise((resolve) => setTimeout(resolve, ANIMATE_POLL_MS));
  }
}

const CATEGORY_LABELS: Record<Category, string> = {
  stay: "숙소",
  tour: "투어·액티비티",
  ticket: "입장권",
  package: "여행 패키지",
};

type TextKey =
  | "name"
  | "region"
  | "priceText"
  | "originalPriceText"
  | "rating"
  | "target"
  | "stayType"
  | "access"
  | "occasion"
  | "affiliateUrl";

const TEXT_FIELDS: Array<{ key: TextKey; label: string; placeholder: string; hint?: string; maxLength: number; wide?: boolean }> = [
  {
    key: "name",
    label: "상품명",
    placeholder: "오션뷰 감성 스테이",
    maxLength: 80,
    wide: true,
    hint: "영상·캡션에는 안 나오고 DM으로만 알려줘요 (스타일 단계에서 바꿀 수 있어요)",
  },
  { key: "region", label: "지역", placeholder: "강원 강릉", maxLength: 40, hint: "마지막 단어가 훅에 쓰여요 (강원 강릉 → 강릉)" },
  { key: "target", label: "추천 대상", placeholder: "아이, 부모님, 커플", maxLength: 40, hint: "로망 문장이 이 대상에 맞춰져요" },
  { key: "stayType", label: "숙소 유형", placeholder: "한옥, 펜션, 리조트", maxLength: 20, hint: "대조형 훅: '한옥인데 노천탕에 진심'" },
  { key: "access", label: "거리·이동", placeholder: "서울에서 1시간", maxLength: 40, hint: "숫자형 훅에 쓰여요" },
  { key: "occasion", label: "여행 상황", placeholder: "겨울 온천 여행, 엄마 칠순", maxLength: 30, hint: "조건형·이야기형 훅에 쓰여요" },
  { key: "priceText", label: "판매가", placeholder: "1박 89,000원~", maxLength: 40, hint: "훅에서 '1박 8만원대'처럼 축약돼요" },
  { key: "originalPriceText", label: "정가 (선택)", placeholder: "129,000원", maxLength: 40, hint: "있으면 할인율 배지가 표시돼요" },
  { key: "rating", label: "평점 (선택)", placeholder: "4.8", maxLength: 10 },
  {
    key: "affiliateUrl",
    label: "제휴(파트너스) 링크",
    placeholder: "https://...",
    maxLength: 2000,
    wide: true,
    hint: "DM·링크 페이지에서는 클릭 수를 세는 단축 링크(/go/…)로 연결돼요.",
  },
];

const MEDIA_ACCEPT = `image/jpeg,image/png,image/webp,${VIDEO_ACCEPT}`;

export function ProductStep({ project, editor, settings }: StepProps) {
  const [url, setUrl] = useState(project.product.sourceUrl);
  const [withImages, setWithImages] = useState(true);
  const [withReviewPhotos, setWithReviewPhotos] = useState(true);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batching, setBatching] = useState(false);
  /** Asset id whose season image is being made or undone, or "batch". */
  const [seasoning, setSeasoning] = useState<string | null>(null);
  /** "all" while mosaicking, or the asset id being restored. */
  const [facing, setFacing] = useState<string | null>(null);
  /** Photos ticked for one batch of AI clips. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [classifying, setClassifying] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { product, assets } = project;
  const canReplicate = replicateReady(settings);

  const setProduct = (patch: Partial<Product>) => editor.change("product", (p) => ({ ...p, ...patch }));

  async function importUrl() {
    if (!url.trim()) return;
    setImporting(true);
    try {
      const { imported } = await editor.run(() =>
        api<{
          project: Project;
          imported: { fields: string[]; images: number; foundImages: number; otherName: string | null; blurred?: number; reviewImages?: number };
        }>(`/api/projects/${project.id}/import`, { method: "POST", json: { url: url.trim(), withImages, withReviewPhotos } }),
      );
      const filled = imported.fields.filter((f) => f !== "sourceUrl" && f !== "platform").length;
      toast.success(
        `정보 ${filled}개, 사진 ${imported.images}장을 가져왔어요.${imported.reviewImages ? ` (후기 사진 ${imported.reviewImages}장 포함)` : ""}${imported.blurred ? ` 사람이 나온 사진 ${imported.blurred}장은 얼굴을 모자이크했어요.` : ""}`,
      );
      if (imported.otherName) {
        toast.error(
          `링크의 숙소(${imported.otherName})가 입력된 숙소(${product.name})와 달라요. 이미 입력된 칸은 그대로 두었으니 이름·지역·특징을 확인해 주세요.`,
        );
      }
      if (withImages && imported.foundImages === 0) {
        toast.info("페이지에서 사진을 찾지 못했어요. 사진은 직접 올려주세요.");
      }
    } catch (error) {
      toast.error(`${errorMessage(error)}\n사이트가 자동 수집을 막는 경우가 있어요. 정보를 직접 입력해 주세요.`);
    } finally {
      setImporting(false);
    }
  }

  const postAssets = (form: FormData) =>
    editor.run(() => api<{ project: Project }>(`/api/projects/${project.id}/assets`, { method: "POST", body: form }));

  async function upload(files: FileList | File[]) {
    const plan = planMediaUpload(Array.from(files), assets);
    if (plan.pairs.length + plan.attach.length + plan.images.length + plan.videos.length === 0) return;
    setUploading(true);
    const added = { images: 0, clips: 0, videos: 0 };
    try {
      for (const { image, video } of plan.pairs) {
        try {
          const form = new FormData();
          form.append("video", video);
          form.append("poster", image);
          await postAssets(form);
          added.clips += 1;
        } catch (error) {
          toast.error(`${video.name}: ${errorMessage(error)}`);
        }
      }
      if (plan.images.length > 0) {
        const form = new FormData();
        for (const file of plan.images) form.append("files", file);
        await postAssets(form);
        added.images = plan.images.length;
      }
      for (const { assetId, video } of plan.attach) {
        try {
          const form = new FormData();
          form.append("file", video);
          await editor.run(() =>
            api<{ project: Project }>(`/api/projects/${project.id}/assets/${encodeURIComponent(assetId)}/clip`, {
              method: "POST",
              body: form,
            }),
          );
          added.clips += 1;
        } catch (error) {
          toast.error(`${video.name}: ${errorMessage(error)}`);
        }
      }
      for (const video of plan.videos) {
        try {
          const form = new FormData();
          form.append("video", video);
          form.append("poster", await videoPoster(video), "poster.jpg");
          await postAssets(form);
          added.videos += 1;
        } catch (error) {
          toast.error(`${video.name}: ${errorMessage(error)}`);
        }
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
    const parts = [
      added.images && `사진 ${added.images}장`,
      added.clips && `영상 ${added.clips}개를 사진에 붙임`,
      added.videos && `영상 ${added.videos}개`,
    ].filter(Boolean);
    if (parts.length > 0) toast.success(`추가 완료: ${parts.join(", ")}`);
  }

  async function removeAsset(assetId: string) {
    try {
      await editor.run(() =>
        api<{ project: Project }>(`/api/projects/${project.id}/assets?assetId=${encodeURIComponent(assetId)}`, {
          method: "DELETE",
        }),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function moveAsset(index: number, delta: -1 | 1) {
    editor.change("assets", (list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    void upload(event.dataTransfer.files);
  }

  /** 런비 recipe: water 3 + signature 2 + room 2, with the best water shot opening the reel. */
  async function classify() {
    setClassifying(true);
    try {
      const { counts } = await editor.run(() =>
        api<{ project: Project; counts: Record<PhotoGroup, number> }>(`/api/projects/${project.id}/assets/classify`, {
          method: "POST",
        }),
      );
      const summary = `물놀이 ${counts.water} · 시그니처 ${counts.signature} · 객실 ${counts.room} · 기타 ${counts.other}`;
      const short = counts.water < 3 || counts.signature < 2 || counts.room < 2;
      toast.success(
        short
          ? `사진을 분류하고 순서를 바꿨어요. (${summary})
물놀이 3·시그니처 2·객실 2장이 되도록 사진을 더 넣으면 좋아요.`
          : `사진을 분류하고 좋은 물놀이 사진이 맨 앞에 오게 바꿨어요. (${summary})`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setClassifying(false);
    }
  }

  async function blurFaces(restore?: string) {
    setFacing(restore ?? "all");
    try {
      const { blurred } = await editor.run(() =>
        api<{ project: Project; blurred: number }>(`/api/projects/${project.id}/assets/faces`, {
          method: "POST",
          json: restore ? { restore } : {},
        }),
      );
      if (restore) toast.success("원본 사진으로 되돌렸어요.");
      else toast.success(blurred ? `사람이 나온 사진 ${blurred}장의 얼굴을 모자이크했어요.` : "새로 모자이크할 얼굴이 없어요.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setFacing(null);
    }
  }

  async function animateAll(chosen?: typeof assets) {
    const targets = chosen ?? animateTargets(assets);
    if (targets.length === 0) return;
    setBatching(true);
    let ok = 0;
    try {
      for (const asset of targets) {
        try {
          await editor.run(() => api<AnimateResult>(animatePath(project.id, asset.id), { method: "POST", json: {} }));
          await waitForAnimate(editor, project.id, asset.id);
          ok += 1;
        } catch (error) {
          toast.error(`${asset.label || "사진"}: ${errorMessage(error)}`);
        }
      }
      if (ok > 0) toast.success(`AI 영상 ${ok}개를 붙였어요.`);
      if (chosen) setPicked(new Set());
    } finally {
      setBatching(false);
    }
  }

  /** Photo → seasonal 9:16 image (the instructor's step before the AI clip). Clips already made are skipped. */
  async function seasonImages(targets: typeof assets, key: string) {
    const todo = targets.filter((a) => !a.videoFile && !a.animateJobId);
    if (todo.length === 0) {
      toast.error("AI 영상이 이미 붙은 사진은 계절 이미지로 바꿀 수 없어요.");
      return;
    }
    setSeasoning(key);
    let ok = 0;
    try {
      for (const asset of todo) {
        try {
          await editor.run(() => api<SeasonResult>(seasonPath(project.id, asset.id), { method: "POST" }));
          await waitForSeason(editor, project.id, asset.id);
          ok += 1;
        } catch (error) {
          toast.error(`${asset.label || "사진"}: ${errorMessage(error)}`);
        }
      }
      if (ok > 0) toast.success(`${SEASON_LABELS[season]} 이미지 ${ok}장으로 바꿨어요. 마음에 들면 AI 영상으로 만들어 보세요.`);
    } finally {
      setSeasoning(null);
    }
  }

  async function undoSeason(assetId: string) {
    setSeasoning(assetId);
    try {
      await editor.run(() => api<{ project: Project }>(seasonPath(project.id, assetId), { method: "DELETE" }));
      toast.success("원래 사진으로 되돌렸어요.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSeasoning(null);
    }
  }

  const season = resolveSeason(project.style.season);
  const busy = batching || seasoning !== null;
  const pickedAssets = assets.filter((a) => picked.has(a.id));
  const clipCost = CLIP_COST_USD[settings?.replicateModel ?? ""] ?? CLIP_COST_USD[DEFAULT_REPLICATE_MODEL];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle
          title="상품 링크로 자동 채우기"
          description="쿠팡 트래블 숙소 주소를 넣으면 원본 사진(최대 20장)·편의시설·평점·베스트 리뷰까지 가져와요. 마이리얼트립·아고다·여기어때 등도 돼요."
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={inputClass}
            placeholder="https://trip.coupang.com/tp/products/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void importUrl()}
          />
          <Button variant="primary" onClick={importUrl} loading={importing} disabled={!url.trim()}>
            가져오기
          </Button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={withImages} onChange={(e) => setWithImages(e.target.checked)} />
          사진도 함께 가져오기 (남은 칸만큼, 최대 {MAX_ASSETS}장)
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={withReviewPhotos}
            disabled={!withImages}
            onChange={(e) => setWithReviewPhotos(e.target.checked)}
          />
          베스트 후기의 손님 사진도 가져오기 (쿠팡)
        </label>
        <p className="mt-2 text-xs text-faint">
          가져온 사진의 저작권은 판매처에 있어요. 제휴 홍보 목적 사용이 허용되는지 각 플랫폼 정책을 확인하세요. 후기 사진은
          손님이 찍은 사진이라 저작권이 작성자에게 있어요. 쓰기 전에 꼭 확인하고, 사진을 사실과 다르게 바꾸지 마세요.
        </p>
      </Card>

      <Card>
        <SectionTitle title="상품 정보" description="비어 있는 칸만 자동으로 채워지고, 직접 고친 내용은 덮어쓰지 않아요." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="분류" htmlFor="category">
            <select
              id="category"
              className={inputClass}
              value={product.category}
              onChange={(e) => setProduct({ category: e.target.value as Category })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          {TEXT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} htmlFor={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
              <input
                id={f.key}
                className={inputClass}
                placeholder={f.placeholder}
                maxLength={f.maxLength}
                value={product[f.key]}
                onChange={(e) => setProduct({ [f.key]: e.target.value })}
              />
            </Field>
          ))}
          <Field
            label="특징·셀링포인트 (한 줄에 하나)"
            hint="사진 라벨과 겹치는 특징은 해당 사진 장면의 자막이 돼요. 예: 통창 오션뷰 → '오션뷰' 사진"
            htmlFor="features"
            className="sm:col-span-2"
          >
            <textarea
              id="features"
              rows={4}
              className={inputClass}
              placeholder={"통창 오션뷰\n개별 바베큐\n스파 욕조"}
              value={product.features.join("\n")}
              onChange={(e) =>
                setProduct({ features: e.target.value.split("\n").slice(0, 12).map((line) => line.slice(0, 60)) })
              }
            />
          </Field>
          <Field
            label="리뷰·소개 메모 (선택)"
            hint="실제 후기에서 좋았던 점을 적어두면 AI가 대본 소재로 써요. 영상에 그대로 나오지는 않아요."
            htmlFor="notes"
            className="sm:col-span-2"
          >
            <textarea
              id="notes"
              rows={3}
              maxLength={2000}
              className={inputClass}
              placeholder="아이들이 온수풀에서 안 나오려고 했다는 후기가 많아요"
              value={product.notes}
              onChange={(e) => setProduct({ notes: e.target.value })}
            />
          </Field>
          <Field
            label="영상에 넣을 실제 후기 한 줄"
            hint={
              <>
                두 번째 장면에 &lsquo;⭐ 실제 이용 후기&rsquo; 말풍선으로 나와요. 실제 후기 문장을 바꾸지 말고 그대로 넣어 주세요.
                비워두면 가져온 베스트 리뷰의 첫 문장을 써요.
              </>
            }
            htmlFor="reviewQuote"
            className="sm:col-span-2"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id="reviewQuote"
                maxLength={80}
                className={inputClass}
                placeholder={quoteFromNotes(product.notes) || "예: 아이들이 온수풀에서 안 나오려고 했어요"}
                value={product.reviewQuote}
                onChange={(e) => setProduct({ reviewQuote: e.target.value })}
              />
              <label className="flex shrink-0 items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-accent)]"
                  checked={project.style.reviewCard}
                  onChange={(e) => editor.change("style", (s) => ({ ...s, reviewCard: e.target.checked }))}
                />
                영상에 후기 말풍선 넣기
              </label>
            </div>
          </Field>
          <label className="flex cursor-pointer items-start gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={product.visited}
              onChange={(e) => setProduct({ visited: e.target.checked })}
            />
            <span>
              <span className="text-sm font-semibold">직접 다녀온 숙소예요 (1인칭 후기 말투)</span>
              <span className="block text-xs text-faint">
                켜면 &apos;너무 좋더라구요 · 힐링 제대로 하고왔어요&apos;처럼 경험담으로 써요. 안 가본 곳을 다녀온 것처럼 쓰면
                표시광고법상 기만 광고가 될 수 있어 꺼두면 추천 말투(&apos;딱 좋아요&apos;)로 바뀌어요.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <SectionTitle
          title={`사진·영상 ${assets.length}/${MAX_ASSETS}`}
          description="사진은 그대로 써도 되고, AI로 움직이는 영상으로 바꿔도 돼요. 자막·로고·(광고) 표시는 어느 쪽이든 자동으로 위에 얹혀요."
          action={
            <div className="flex flex-wrap justify-end gap-1">
              {assets.length > 1 ? (
                <Button
                  size="sm"
                  onClick={() => void classify()}
                  loading={classifying}
                  disabled={!visionReady(settings) || uploading || batching}
                  title={visionReady(settings) ? undefined : "설정에서 Gemini 또는 OpenAI 키를 넣으면 쓸 수 있어요"}
                >
                  AI로 사진 분류·정렬
                </Button>
              ) : null}
              {assets.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() => void blurFaces()}
                  loading={facing === "all"}
                  disabled={uploading || batching || facing !== null || assets.every((a) => a.faceChecked)}
                  title={assets.every((a) => a.faceChecked) ? "모든 사진을 이미 확인했어요" : "사람 얼굴을 찾아 모자이크해요. 원본은 따로 보관돼요."}
                >
                  인물 모자이크
                </Button>
              ) : null}
              <label
                className={cx(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  canReplicate ? "border-line text-fg" : "border-line text-faint",
                )}
                title={canReplicate ? "원클릭 자동 생성 때 물놀이 3장·시그니처 2장을 AI 영상으로 만들어요. 장당 요금이 나가요." : "설정에서 AI 영상 키(Replicate)를 넣으면 켤 수 있어요"}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-accent)]"
                  checked={project.style.animatePhotos}
                  disabled={!canReplicate}
                  onChange={(e) => editor.change("style", (s) => ({ ...s, animatePhotos: e.target.checked }))}
                />
                자동 생성 때 사진을 AI 영상으로
              </label>
              <label
                className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-fg"
                title="대본을 만들 때, 대사에 어울리는 무료 풍경 사진(CC0·CC BY·CC BY-SA) 1~2장을 장면 중간에 넣고 캡션에 출처를 붙여요."
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-accent)]"
                  checked={project.style.autoScenery}
                  onChange={(e) => editor.change("style", (s) => ({ ...s, autoScenery: e.target.checked }))}
                />
                대본에 맞는 무료 풍경 컷 넣기
              </label>
              {canReplicate ? (
                <label
                  className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-fg"
                  title="사진을 AI 영상으로 만들기 전에, 이 계절 느낌을 입힌 9:16 이미지로 먼저 바꿔요."
                >
                  계절
                  <select
                    aria-label="계절 이미지 계절"
                    className="rounded-md bg-transparent py-0.5 text-xs font-semibold outline-none"
                    value={project.style.season}
                    disabled={busy}
                    onChange={(e) => editor.change("style", (s) => ({ ...s, season: e.target.value as Season }))}
                  >
                    {SEASONS.map((value) => (
                      <option key={value} value={value}>
                        {value === "auto" ? `자동 (지금은 ${SEASON_LABELS[resolveSeason("auto")]})` : SEASON_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {canReplicate && pickedAssets.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() => void seasonImages(pickedAssets, "batch")}
                  loading={seasoning === "batch"}
                  disabled={uploading || busy}
                  title={`사진을 ${SEASON_LABELS[season]} 느낌의 9:16 이미지로 먼저 바꿔요. 한 장에 약 ${Math.round(SEASON_IMAGE_COST_USD * KRW_PER_USD)}원 · Replicate 요금`}
                >
                  ① 선택한 {pickedAssets.length}장 {SEASON_LABELS[season]} 이미지로 · 약{" "}
                  {Math.round(pickedAssets.length * SEASON_IMAGE_COST_USD * KRW_PER_USD).toLocaleString("ko-KR")}원
                </Button>
              ) : null}
              {canReplicate && pickedAssets.length > 0 ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void animateAll(pickedAssets)}
                  loading={batching}
                  disabled={uploading}
                  title={`한 장에 약 $${clipCost} (약 ${Math.round(clipCost * KRW_PER_USD)}원) · Replicate 요금`}
                >
                  ② 선택한 {pickedAssets.length}장 AI 영상으로 · 약 {Math.round(pickedAssets.length * clipCost * KRW_PER_USD).toLocaleString("ko-KR")}원
                </Button>
              ) : null}
              {canReplicate && pickedAssets.length === 0 && animateTargets(assets).length > 0 ? (
                <Button size="sm" onClick={() => void animateAll()} loading={batching} disabled={uploading}>
                  {assets.some((a) => a.group)
                    ? `물놀이·시그니처 ${animateTargets(assets).length}장 AI 영상으로`
                    : "영상 없는 사진 전부 AI 영상으로"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="primary"
                onClick={() => fileInput.current?.click()}
                loading={uploading}
                disabled={assets.length >= MAX_ASSETS || batching}
              >
                사진·영상 추가
              </Button>
            </div>
          }
        />
        <input
          ref={fileInput}
          type="file"
          accept={MEDIA_ACCEPT}
          multiple
          hidden
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cx(
            "rounded-xl border-2 border-dashed p-3 transition",
            dragOver ? "border-accent bg-accent/5" : "border-line",
          )}
        >
          {assets.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center gap-2 py-10 text-sm text-muted"
            >
              <span className="text-3xl">📷</span>
              사진·영상을 끌어다 놓거나 눌러서 선택하세요 (JPG·PNG·WEBP 15MB, MP4·MOV·WEBM 100MB)
            </button>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {assets.map((asset, i) => (
                <li key={asset.id} className="overflow-hidden rounded-xl border border-line bg-surface-2">
                  <div className="relative aspect-[4/5]">
                    {asset.videoFile ? (
                      // The AI clip plays on its own (muted, looping) so the card shows what the reel will show.
                      <video
                        // React doesn't put `muted` on the element before load, so browsers block autoplay; force it.
                        ref={(el) => {
                          if (!el) return;
                          el.muted = true;
                          void el.play().catch(() => {});
                        }}
                        src={projectFileUrl(project.id, asset.videoFile)}
                        poster={projectFileUrl(project.id, asset.file)}
                        autoPlay
                        muted
                        loop
                        playsInline
                        aria-label={`${asset.label} AI 영상`}
                        className="size-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- user media served by our own API
                      <img src={projectFileUrl(project.id, asset.file)} alt={asset.label} className="size-full object-cover" />
                    )}
                    {asset.videoFile ? null : asset.animateJobId || asset.seasonJobId ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white">
                        {asset.seasonJobId ? "계절 이미지 만드는 중…" : "만드는 중…"}
                      </span>
                    ) : null}
                    <span className="absolute top-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
                      {i === 0 ? "1 · 훅" : i + 1}
                    </span>
                    {canReplicate ? (
                      <label
                        className="absolute bottom-2 left-2 flex cursor-pointer items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] font-bold text-white"
                        title="체크한 사진을 한 번에 계절 이미지나 AI 영상으로 만들어요"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--color-accent)]"
                          checked={picked.has(asset.id)}
                          disabled={busy || Boolean(asset.animateJobId || asset.seasonJobId)}
                          onChange={(e) =>
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(asset.id);
                              else next.delete(asset.id);
                              return next;
                            })
                          }
                        />
                        선택
                      </label>
                    ) : null}
                    {asset.videoFile ? (
                      <span className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {asset.season ? `${SEASON_LABELS[asset.season]} · 영상` : "영상"}
                      </span>
                    ) : asset.season ? (
                      <span className="absolute top-2 right-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {SEASON_LABELS[asset.season]} 이미지
                      </span>
                    ) : asset.fromReview ? (
                      <span className="absolute top-2 right-2 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        후기{asset.originalFile ? " · 모자이크" : ""}
                      </span>
                    ) : asset.originalFile ? (
                      <span className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        모자이크
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 p-2">
                    <input
                      aria-label={`${i + 1}번 사진 라벨`}
                      className={cx(inputClass, "py-1.5 text-xs")}
                      placeholder="라벨 (오션뷰, 객실…)"
                      maxLength={30}
                      value={asset.label}
                      onChange={(e) =>
                        editor.change("assets", (list) =>
                          list.map((a) => (a.id === asset.id ? { ...a, label: e.target.value } : a)),
                        )
                      }
                    />
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => moveAsset(i, -1)} disabled={i === 0} aria-label="앞으로">
                        ←
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveAsset(i, 1)}
                        disabled={i === assets.length - 1}
                        aria-label="뒤로"
                      >
                        →
                      </Button>
                      <Button size="sm" variant="ghost" className="ml-auto text-danger" onClick={() => removeAsset(asset.id)}>
                        삭제
                      </Button>
                    </div>
                    {asset.credit ? (
                      <a
                        href={asset.credit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline"
                        title={`${asset.credit.title} — ${asset.credit.author} (${asset.credit.license}). 캡션에 출처가 자동으로 들어가요.`}
                      >
                        무료 풍경 · {asset.credit.license} · {asset.credit.author}
                      </a>
                    ) : null}
                    {asset.originalFile ? (
                      <button
                        type="button"
                        onClick={() => void blurFaces(asset.id)}
                        disabled={facing !== null}
                        className="self-end text-xs text-muted underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
                      >
                        {facing === asset.id ? "되돌리는 중…" : "모자이크 취소"}
                      </button>
                    ) : null}
                    {canReplicate && !asset.videoFile && !asset.animateJobId ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => void seasonImages([asset], asset.id)}
                          loading={seasoning === asset.id || Boolean(asset.seasonJobId)}
                          disabled={busy || Boolean(asset.seasonJobId)}
                          title={`사진을 ${SEASON_LABELS[season]} 느낌의 9:16 이미지로 바꿔요 (약 ${Math.round(SEASON_IMAGE_COST_USD * KRW_PER_USD)}원). 원본은 보관돼요.`}
                        >
                          {asset.season ? `${SEASON_LABELS[season]} 이미지 다시` : `${SEASON_LABELS[season]} 이미지로`}
                        </Button>
                        {asset.preSeasonFile ? (
                          <button
                            type="button"
                            onClick={() => void undoSeason(asset.id)}
                            disabled={busy}
                            className="shrink-0 text-xs text-muted underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
                          >
                            원래 사진
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <AssetVideoClip
                      projectId={project.id}
                      asset={asset}
                      editor={editor}
                      canReplicate={canReplicate}
                      locked={busy}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-3 text-xs text-faint">
          순서를 바꾼 뒤에는 대본을 다시 만들어야 장면에 반영돼요. 사진만 있으면 천천히 확대·이동하는 효과가 들어가고, 영상이
          있으면 그 영상이 재생돼요.{" "}
          {canReplicate ? (
            "각 사진의 ‘AI 영상으로 만들기’나 위 ‘물놀이·시그니처 AI 영상으로’를 누르면 돼요. 한 장 만들 때마다 AI 영상 요금이 조금씩 나가요."
          ) : (
            <>
              <button type="button" onClick={openSettings} className="text-accent underline-offset-2 hover:underline">
                설정에서 AI 영상 키
              </button>
              를 넣으면 사진을 움직이는 영상으로 바로 바꿀 수 있어요.
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
