import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { projectFileUrl } from "@/lib/client/api";
import { COUPANG_DISCLOSURE } from "@/lib/script/copy";
import { getSettings, listProjects } from "@/lib/server/store";
import type { Project } from "@/lib/types";

export const metadata: Metadata = { title: "예약 링크 모음" };

function coverUrl(p: Project): string | null {
  const file = p.render.thumbnailFile ?? p.assets[0]?.file;
  return file ? projectFileUrl(p.id, file, p.render.finishedAt) : null;
}

export default function LinksPage() {
  return (
    <div className="mx-auto min-h-screen max-w-md px-5 py-12">
      <Suspense fallback={<p className="py-20 text-center text-muted">불러오는 중…</p>}>
        <LinkList />
      </Suspense>
    </div>
  );
}

/**
 * Captions say "프로필링크 N번", so numbered links come first (newest number on top) and each number
 * appears once; hook-swapped copies share their original's number and the latest edit wins.
 */
function orderLinks(projects: Project[]): Project[] {
  const seen = new Set<number>();
  const numbered = projects.filter((p) => {
    const n = p.copy.linkNumber;
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  numbered.sort((a, b) => (b.copy.linkNumber ?? 0) - (a.copy.linkNumber ?? 0));
  return [...numbered, ...projects.filter((p) => !p.copy.linkNumber)];
}

async function LinkList() {
  await connection();
  const [projects, settings] = await Promise.all([listProjects(), getSettings()]);
  const items = orderLinks(projects.filter((p) => /^https?:\/\//i.test(p.product.affiliateUrl)));

  return (
    <>
      <header className="text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-3xl">
          ✈️
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">{settings.linkPageTitle}</h1>
        {settings.instagramHandle ? <p className="mt-1 text-sm text-accent">{settings.instagramHandle}</p> : null}
        <p className="mt-2 text-sm text-muted">{settings.linkPageBio}</p>
      </header>

      {items.some((p) => p.product.platform === "coupang") ? (
        <p className="mt-6 rounded-xl border border-line bg-surface-2 p-3 text-center text-xs text-muted">
          {COUPANG_DISCLOSURE}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted">아직 등록된 예약 링크가 없어요.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {items.map((p) => {
            const cover = coverUrl(p);
            return (
              <li key={p.id}>
                <a
                  href={`/go/${p.id}`}
                  rel="sponsored noopener"
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:-translate-y-0.5 hover:border-accent/60"
                >
                  {p.copy.linkNumber ? (
                    <span className="w-9 shrink-0 text-center text-lg font-extrabold text-accent">{p.copy.linkNumber}</span>
                  ) : null}
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user media served by our own API */}
                    {cover ? <img src={cover} alt="" className="size-full object-cover" loading="lazy" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.product.name || p.title}</p>
                    <p className="truncate text-xs text-muted">
                      {[p.product.region, p.product.priceText].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white">예약하기</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-10 text-center text-[11px] text-faint">
        이 페이지의 링크는 제휴 링크로, 예약 시 운영자가 일정 수수료를 받을 수 있어요. 구매자에게 추가 비용은 없어요.
      </p>
    </>
  );
}
