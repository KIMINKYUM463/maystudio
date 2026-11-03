"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "@/components/toast";
import { Button, Card, Field, inputClass, SectionTitle, cx } from "@/components/ui";
import { api, errorMessage, projectFileUrl } from "@/lib/client/api";
import { videoPoster } from "@/lib/client/video-poster";
import { planMediaUpload } from "@/lib/media-pair";
import { replicateReady } from "@/lib/settings-view";
import { CATEGORIES, MAX_ASSETS, type Category, type Product, type Project } from "@/lib/types";
import { animatePath, AssetVideoClip, VIDEO_ACCEPT, waitForAnimate, type AnimateResult } from "./AssetVideoClip";
import type { StepProps } from "./useProjectEditor";

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
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batching, setBatching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { product, assets } = project;
  const canReplicate = replicateReady(settings);
  const stills = assets.filter((a) => !a.videoFile);

  const setProduct = (patch: Partial<Product>) => editor.change("product", (p) => ({ ...p, ...patch }));

  async function importUrl() {
    if (!url.trim()) return;
    setImporting(true);
    try {
      const { imported } = await editor.run(() =>
        api<{
          project: Project;
          imported: { fields: string[]; images: number; foundImages: number; otherName: string | null };
        }>(`/api/projects/${project.id}/import`, { method: "POST", json: { url: url.trim(), withImages } }),
      );
      const filled = imported.fields.filter((f) => f !== "sourceUrl" && f !== "platform").length;
      toast.success(`정보 ${filled}개, 사진 ${imported.images}장을 가져왔어요.`);
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

  async function animateAll() {
    const targets = assets.filter((a) => !a.videoFile);
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
      if (ok > 0) toast.success(`Replicate 영상 ${ok}개를 붙였어요.`);
    } finally {
      setBatching(false);
    }
  }

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
        <p className="mt-2 text-xs text-faint">
          가져온 사진의 저작권은 판매처에 있어요. 제휴 홍보 목적 사용이 허용되는지 각 플랫폼 정책을 확인하세요.
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
          description="Replicate/Flow는 배경 영상만 만듭니다. 자막·로고·(광고)·장면 전환 모션그래픽은 Remotion이 그 위에 따로 올립니다. 둘 다 최종 릴스에 같이 나가요."
          action={
            <div className="flex flex-wrap justify-end gap-1">
              {canReplicate && stills.length > 0 ? (
                <Button size="sm" onClick={() => void animateAll()} loading={batching} disabled={uploading}>
                  영상 없는 사진 전부
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- user media served by our own API */}
                    <img src={projectFileUrl(project.id, asset.file)} alt={asset.label} className="size-full object-cover" />
                    {asset.videoFile ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-3xl text-white">▶</span>
                    ) : asset.animateJobId ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white">
                        만드는 중…
                      </span>
                    ) : null}
                    <span className="absolute top-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
                      {i === 0 ? "1 · 훅" : i + 1}
                    </span>
                    {asset.videoFile ? (
                      <span className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        영상
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
                    <AssetVideoClip
                      projectId={project.id}
                      asset={asset}
                      editor={editor}
                      canReplicate={canReplicate}
                      locked={batching}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-3 text-xs text-faint">
          순서를 바꾼 뒤에는 대본을 다시 만들어야 장면에 반영돼요. 배경에 클립이 없으면 Ken Burns(줌/팬), 있으면 그 mp4가
          재생되고 — 어느 쪽이든 자막·로고 모션그래픽은 위에 그대로 나가요.{" "}
          {canReplicate ? (
            "각 사진의 ‘Replicate로 만들기’ 또는 위 ‘영상 없는 사진 전부’로 배경 영상만 채우면 됩니다. 한 장당 Replicate 요금이 나가요."
          ) : (
            <>
              <Link href="/settings" className="text-accent underline-offset-2 hover:underline">
                설정에서 Replicate 토큰
              </Link>
              을 넣으면 Flow 없이 배경 영상을 만들어요.
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
