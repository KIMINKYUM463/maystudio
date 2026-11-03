"use client";

import { CopyButton } from "@/components/CopyButton";
import { Button, buttonClass, Card, ProgressBar, SectionTitle, cx } from "@/components/ui";
import { downloadUrl, projectFileUrl, shortLinkUrl } from "@/lib/client/api";
import { hasDisclosureFirst } from "@/lib/script/copy";
import { buildVideoProps, formatDuration, videoDurationInFrames } from "@/lib/video/props";
import type { Project } from "@/lib/types";
import type { StepProps } from "./useProjectEditor";

const RENDER_LABELS: Record<Project["render"]["status"], string> = {
  idle: "아직 렌더링하지 않았어요",
  queued: "렌더링 준비 중…",
  bundling: "영상 엔진 준비 중… (처음 한 번은 1~2분 걸려요)",
  rendering: "영상 만드는 중…",
  done: "영상 완성!",
  error: "렌더링에 실패했어요",
};

const UPLOAD_TIPS = [
  "커버는 함께 받은 커버 이미지로 지정하세요. 프로필 그리드에서 클릭률이 달라져요.",
  "캡션 첫 줄의 대가성 문구(쿠팡 파트너스 문구)는 지우지 마세요. 링크 페이지에도 자동으로 표시돼요.",
  "숙소 이름은 캡션·댓글에 쓰지 말고, 키워드 댓글을 단 사람에게 DM으로만 보내세요.",
  "공개 직후 고정 댓글을 달고, 첫 1시간 안에 달린 댓글에 빠르게 답하세요.",
  "조회수가 안 나오면 영상은 그대로 두고 첫 문장(훅)만 바꿔 다시 올리세요. 대시보드의 '훅만 바꿔 다시 만들기'를 쓰면 돼요.",
  "조회수 → 클릭 → 구매 순서로 보세요. 조회수는 높은데 클릭이 적으면 CTA·키워드를, 클릭은 많은데 구매가 없으면 숙소를 바꿔보세요.",
];

export type RenderStarter = { start: () => Promise<void>; starting: boolean; active: boolean };

/** Benchmark posting routine: reel + carousel per stay, any-comment DM, numbered profile links. */
const REVIEW_UPLOAD_TIPS = [
  "릴스 커버는 함께 받은 커버 이미지로 지정하세요. 프로필 그리드(3:4)에서 문구가 잘리지 않게 만들어졌어요.",
  "배경 영상(Replicate)과 모션그래픽(자막·로고·전환)은 따로입니다. 영상 위에 자막이 같이 나가니, 상품 단계에서 사진→영상을 만들면 됩니다.",
  "같은 숙소로 캐러셀(4:5 사진 묶음) 게시물도 하나 더 올리세요. 벤치마크 채널은 릴스와 캐러셀을 번갈아 올려요.",
  "캡션은 그대로 붙여넣으세요. 첫 줄 [광고]와 끝의 대가성 문구는 지우지 마세요.",
  "DM 자동화는 키워드 없이 '모든 댓글'에 반응하게 설정하세요. 캡션이 '아무 댓글이나'라고 안내해요.",
  "프로필 링크 페이지에 캡션에 적힌 번호 그대로 링크를 올리세요. 번호는 '링크 모음' 페이지에서 확인할 수 있어요.",
  "조회수가 안 나오면 훅만 바꿔 다시 올리세요. 대시보드의 '훅만 바꿔 다시 만들기'를 쓰면 돼요.",
];

function checklist(project: Project) {
  const { assets, scenes, product, style, voice, copy } = project;
  const review = style.template === "review";
  return [
    { ok: scenes.length > 0, label: "대본(장면)이 있어요", required: true },
    { ok: assets.length >= 10, label: `사진 10장 이상, 15~20장 권장 (현재 ${assets.length}장)` },
    {
      ok: assets.some((a) => a.videoFile),
      label: assets.some((a) => a.videoFile)
        ? `배경 영상 ${assets.filter((a) => a.videoFile).length}/${assets.length}컷 (+ 자막·로고 모션그래픽)`
        : "배경 영상이 없어요 — 사진은 Ken Burns, 자막·로고 모션그래픽은 그대로 올라가요",
    },
    ...(review
      ? [
          { ok: Boolean(style.logoFile), label: "채널 로고를 넣었어요" },
          { ok: Boolean(copy.linkNumber), label: copy.linkNumber ? `프로필링크 ${copy.linkNumber}번` : "프로필링크 번호 (대본 생성 시 자동)" },
        ]
      : []),
    { ok: Boolean(product.affiliateUrl), label: "제휴 링크를 넣었어요" },
    { ok: style.showAdLabel, label: "영상 속 광고 표시가 켜져 있어요" },
    { ok: hasDisclosureFirst(copy.caption), label: "캡션 첫 줄에 대가성 문구가 있어요" },
    {
      ok: voice.provider === "none" || scenes.every((s) => s.audioFile),
      label: voice.provider === "none" ? "나레이션 없이 자막으로 진행" : "모든 장면 나레이션 생성 완료",
    },
  ];
}

export function ExportStep({ project, renderer }: StepProps & { renderer: RenderStarter }) {
  const { render } = project;
  const items = checklist(project);
  const blocked = items.some((i) => i.required && !i.ok);
  const seconds = formatDuration(videoDurationInFrames(buildVideoProps(project, (f) => f)));
  const version = render.finishedAt;
  const videoUrl = render.status === "done" && render.outputFile ? projectFileUrl(project.id, render.outputFile, version) : null;
  const thumbUrl = render.thumbnailFile ? projectFileUrl(project.id, render.thumbnailFile, version) : null;
  const slideUrls = videoUrl ? render.carouselFiles.map((file) => projectFileUrl(project.id, file, version)) : [];
  const tips = project.style.template === "review" ? REVIEW_UPLOAD_TIPS : UPLOAD_TIPS;
  const fileBase = (project.product.name || project.title).replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "travel_short";
  const link = project.product.affiliateUrl ? shortLinkUrl(project.id) : "";

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle title="렌더링 전 점검" description={`예상 길이 ${seconds} · 1080×1920 · 30fps MP4`} />
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <span
                className={cx(
                  "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
                  item.ok ? "bg-success text-black" : item.required ? "bg-danger text-white" : "bg-surface-3 text-muted",
                )}
              >
                {item.ok ? "✓" : "!"}
              </span>
              <span className={item.ok ? "text-fg" : "text-muted"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle
          title="MP4 만들기"
          description={RENDER_LABELS[render.status]}
          action={
            <Button
              variant="primary"
              size="lg"
              onClick={() => void renderer.start()}
              loading={renderer.starting || renderer.active}
              disabled={blocked}
            >
              {renderer.active ? `${Math.round(render.progress * 100)}%` : render.status === "done" ? "다시 렌더링" : "영상 만들기"}
            </Button>
          }
        />
        {renderer.active ? <ProgressBar value={render.progress} /> : null}
        {render.status === "error" && render.error ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-danger/10 p-3 text-xs whitespace-pre-wrap text-danger">
            {render.error}
          </pre>
        ) : null}

        {videoUrl ? (
          <div className="mt-4 grid gap-5 sm:grid-cols-[220px_1fr]">
            <video
              key={videoUrl}
              src={videoUrl}
              poster={thumbUrl ?? undefined}
              controls
              playsInline
              className="aspect-[9/16] w-full rounded-xl bg-black"
            />
            <div className="flex flex-col gap-3">
              <a href={downloadUrl(videoUrl, `${fileBase}.mp4`)} className={buttonClass({ variant: "primary" })}>
                영상 다운로드 (MP4)
              </a>
              {thumbUrl ? (
                <a href={downloadUrl(thumbUrl, `${fileBase}_cover.jpg`)} className={buttonClass()}>
                  커버 이미지 다운로드
                </a>
              ) : null}
              {render.finishedAt ? (
                <p className="text-xs text-faint">완성: {new Date(render.finishedAt).toLocaleString("ko-KR")}</p>
              ) : null}
              <p className="text-xs text-faint">
                휴대폰으로 옮겨 인스타그램 앱에서 릴스로 올리세요. 미리보기와 다르게 보이면 다시 렌더링하세요.
              </p>
            </div>
          </div>
        ) : null}
      </Card>

      {slideUrls.length ? (
        <Card>
          <SectionTitle
            title={`캐러셀 ${slideUrls.length}장 (4:5)`}
            description="인스타그램에서 여러 장 게시물로 순서대로 올리세요. 1장이 표지예요."
          />
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {slideUrls.map((url, i) => (
              <li key={url}>
                <a href={downloadUrl(url, `${fileBase}_${String(i + 1).padStart(2, "0")}.jpg`)} title={`${i + 1}장 다운로드`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- rendered output served by our own API */}
                  <img src={url} alt={`캐러셀 ${i + 1}장`} className="aspect-[4/5] w-full rounded-lg bg-black object-cover" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-faint">사진을 누르면 한 장씩 받아져요.</p>
        </Card>
      ) : null}

      <Card>
        <SectionTitle
          title="클릭 추적 링크"
          description="DM·프로필 링크에 이 주소를 쓰면 대시보드에서 클릭 수를 볼 수 있어요. (배포 후 공개 주소에서 동작)"
        />
        {link ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">{link}</code>
            <CopyButton text={link} />
          </div>
        ) : (
          <p className="text-sm text-faint">상품 정보 단계에서 제휴 링크를 넣으면 만들어져요.</p>
        )}
      </Card>

      <Card>
        <SectionTitle title="업로드 체크리스트" />
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
