"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { toast } from "@/components/toast";
import { Button, Card, inputClass, SectionTitle } from "@/components/ui";
import { shortLinkUrl } from "@/lib/client/api";
import {
  buildCopy,
  COUPANG_DISCLOSURE,
  fillDmLink,
  hasDisclosureFirst,
  hookLineFor,
  MAX_HASHTAGS,
  normalizeTag,
} from "@/lib/script/copy";
import type { Copy } from "@/lib/types";
import type { StepProps } from "./useProjectEditor";

const CAPTION_LIMIT = 2200;
const MAX_STORED_TAGS = 10;

const parseTags = (text: string) => text.split(/\s+/).map(normalizeTag).filter(Boolean).slice(0, MAX_STORED_TAGS);

/** Keeps the raw text while typing (so spaces work) and stores the normalized tag list. */
function HashtagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState(() => value.join(" "));
  const [synced, setSynced] = useState(value);
  if (synced !== value && parseTags(text).join(" ") !== value.join(" ")) {
    // The list was replaced from outside (e.g. "다시 만들기"), so show the new tags.
    setSynced(value);
    setText(value.join(" "));
  }
  return (
    <input
      className={inputClass}
      value={text}
      placeholder="강릉숙소 강릉여행 감성숙소"
      onChange={(e) => {
        const tags = parseTags(e.target.value);
        setText(e.target.value);
        setSynced(tags);
        onChange(tags);
      }}
      onBlur={() => setText(value.join(" "))}
    />
  );
}

export function CopyStep({ project, editor }: StepProps) {
  const { copy, product } = project;
  const link = product.affiliateUrl ? shortLinkUrl(project.id) : "";
  const dmWithLink = link ? fillDmLink(copy.dmTemplate, link) : copy.dmTemplate;

  const setCopy = (patch: Partial<Copy>) => editor.change("copy", (c) => ({ ...c, ...patch }));

  const isReview = project.style.template === "review";

  function rebuild() {
    if (copy.caption && !confirm("직접 고친 문구가 새 문구로 바뀌어요. 계속할까요?")) return;
    const hook = hookLineFor(project.scenes, project.style.template) || product.name;
    setCopy(buildCopy(project, hook, copy.commentKeyword || "숙소"));
    toast.success("상품 정보와 훅으로 문구를 다시 만들었어요.");
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle
          title="릴스 캡션"
          description={
            isReview
              ? `벤치마크 구성: [광고] 훅 → 후기 이야기 → ✔️ 체크리스트 → 추천 → 📌 아무 댓글 DM → ❤️ 프로필링크 ${copy.linkNumber ?? "N"}번 → 대가성 문구 → 해시태그`
              : "첫 줄은 대가성 문구, 마지막 줄은 댓글 키워드 안내예요. 숙소 이름은 DM에서만 알려줘야 '여기 어디예요?' 댓글이 달려요."
          }
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={rebuild}>
                다시 만들기
              </Button>
              <CopyButton text={copy.caption} label="캡션 복사" />
            </div>
          }
        />
        <textarea
          rows={12}
          maxLength={CAPTION_LIMIT}
          className={inputClass}
          value={copy.caption}
          placeholder="대본을 생성하면 캡션이 자동으로 채워져요."
          onChange={(e) => setCopy({ caption: e.target.value })}
        />
        <p className="mt-1 text-right text-xs text-faint">
          {copy.caption.length.toLocaleString()} / {CAPTION_LIMIT.toLocaleString()}
        </p>
        {copy.caption && !hasDisclosureFirst(copy.caption) ? (
          <p className="mt-2 text-xs text-warning">
            캡션 첫 줄에 대가성 문구가 없어요. 제휴 콘텐츠는 첫 줄처럼 잘 보이는 곳에 수수료를 받는다는 사실을 밝혀야 해요.
            {product.platform === "coupang" ? ` 쿠팡 파트너스 문구: "${COUPANG_DISCLOSURE}"` : ""}
          </p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle
          title="해시태그"
          description={`인스타그램은 해시태그를 ${MAX_HASHTAGS}개 이하로 권장해요. 지역+숙소유형 조합이 검색에 가장 잘 걸려요.`}
          action={<CopyButton text={copy.hashtags.map((t) => `#${t}`).join(" ")} />}
        />
        <HashtagInput value={copy.hashtags} onChange={(hashtags) => setCopy({ hashtags })} />
        <p className="mt-2 text-xs text-faint">
          {copy.hashtags.length > MAX_HASHTAGS ? `${copy.hashtags.length}개 — ${MAX_HASHTAGS}개 이하로 줄이는 걸 권장해요. ` : ""}
          띄어쓰기로 구분해요. 해시태그를 바꿔도 캡션 본문은 자동으로 바뀌지 않아요.
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title="고정 댓글" action={<CopyButton text={copy.pinnedComment} />} />
          <textarea
            rows={3}
            maxLength={300}
            className={inputClass}
            value={copy.pinnedComment}
            onChange={(e) => setCopy({ pinnedComment: e.target.value })}
          />
        </Card>
        <Card>
          <SectionTitle title="DM 자동 응답 문구" action={<CopyButton text={dmWithLink} label="링크 넣어 복사" />} />
          <textarea
            rows={5}
            maxLength={1000}
            className={inputClass}
            value={copy.dmTemplate}
            onChange={(e) => setCopy({ dmTemplate: e.target.value })}
          />
          <p className="mt-2 text-xs text-faint">
            {link ? (
              <>
                {"{링크}"} 자리에 클릭 추적 링크 <span className="text-muted">{link}</span> 가 들어가요.
              </>
            ) : (
              "상품 정보에 제휴 링크를 넣으면 {링크} 자리에 클릭 추적 링크가 들어가요."
            )}
          </p>
        </Card>
      </div>

      <Card>
        <SectionTitle title="댓글 → DM 자동화 설정 (ManyChat 등)" />
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>인스타그램을 프로페셔널(비즈니스/크리에이터) 계정으로 전환하고 ManyChat 같은 DM 자동화 도구에 연결해요.</li>
          {isReview ? (
            <li>
              트리거를 <b className="text-fg">특정 게시물 댓글</b>, 키워드 조건을 <b className="text-fg">모든 댓글(Any comment)</b>로
              설정해요. 캡션이 &quot;아무 댓글이나 남겨주시면&quot;이라서 키워드를 걸면 DM이 안 가요.
            </li>
          ) : (
            <li>
              트리거를 <b className="text-fg">특정 게시물 댓글</b>, 키워드를 <b className="text-fg">&apos;{copy.commentKeyword}&apos;</b>로
              설정해요.
            </li>
          )}
          {isReview && copy.linkNumber ? (
            <li>
              프로필 링크 페이지(링크트리 등)에 이 숙소 링크를 <b className="text-fg">{copy.linkNumber}번</b>으로 올려요. 번호는 앱의
              &apos;링크 모음&apos; 페이지와 같아요.
            </li>
          ) : null}
          <li>응답 메시지에 위 DM 문구(링크 포함)를 붙여넣어요. 댓글에도 &quot;DM 보냈어요!&quot; 자동 답글을 달면 노출이 늘어요.</li>
          <li>
            릴스 공개 직후 <b className="text-fg">고정 댓글</b>을 달고 고정해요.
          </li>
        </ol>
        <p className="mt-3 text-xs text-faint">
          클릭 추적 링크는 이 프로그램이 인터넷에 공개(배포)되어 있어야 팔로워가 열 수 있어요. 로컬에서만 쓸 때는 제휴 링크 원본을 쓰세요.
        </p>
      </Card>
    </div>
  );
}
