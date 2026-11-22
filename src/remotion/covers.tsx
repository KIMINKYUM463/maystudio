import React from "react";
import { AbsoluteFill, Img } from "remotion";
import type { CoverFont, CoverTemplate } from "../lib/types";
import type { VideoProps } from "../lib/video/props";
import { Logo } from "./components";
import { fontFamilyFor } from "./font-choices";
import { FONT } from "./theme";

/**
 * Picked cover designs (style.coverTemplate). Every text block stays inside y 300~1600 so the
 * profile grid's 3:4 crop (y 240~1680 of 1080x1920) never cuts it.
 */
type CoverProps = { imageSrc: string | null; text: string; props: VideoProps };

const Photo: React.FC<{ src: string | null; style?: React.CSSProperties }> = ({ src, style }) =>
  src ? (
    <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />
  ) : (
    <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg,#c9d6ea,#7c93b8)", ...style }} />
  );

const lines = (text: string) =>
  text
    .replace(/,|\.(?!\d)/g, "") // keeps "9.5점"
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const longest = (text: string) => Math.max(1, ...lines(text).map((l) => l.replace(/\s/g, "").length));

/** Font size that keeps the longest line inside `width` px (Korean glyphs are ~1em wide). */
const fit = (text: string, width: number, max: number, min = 64) => Math.max(min, Math.min(max, Math.floor(width / longest(text))));

const priceLine = (p: VideoProps["product"]) => p.priceText.trim();

/** 굵은 한 방: heavy gothic with a thick outline, last line in the accent colour. */
const Bold: React.FC<CoverProps> = ({ imageSrc, text, props }) => {
  const size = fit(text, 940, 150);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Photo src={imageSrc} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 55%)" }} />
      <Logo src={props.logoSrc} top={290} />
      <div style={{ position: "absolute", top: "38%", width: "100%", padding: "0 60px", transform: "translateY(-50%)", textAlign: "center" }}>
        {lines(text).map((line, i, all) => (
          <div
            key={i}
            style={{
              fontFamily: FONT.display,
              fontSize: size,
              lineHeight: 1.15,
              color: i === all.length - 1 && all.length > 1 ? props.style.accentColor : "#fff",
              WebkitTextStroke: "16px #111",
              paintOrder: "stroke fill",
              textShadow: "0 8px 22px rgba(0,0,0,.35)",
              wordBreak: "keep-all",
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 매거진: serif headline bottom-left over a deep gradient, a thin rule and the region as a kicker. */
const Magazine: React.FC<CoverProps> = ({ imageSrc, text, props }) => {
  const size = fit(text, 900, 112, 60);
  const region = props.product.region.trim();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Photo src={imageSrc} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg,rgba(0,0,0,.25) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 45%,rgba(0,0,0,.78) 88%)" }} />
      <Logo src={props.logoSrc} top={290} />
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 380, color: "#fff" }}>
        {region ? (
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: FONT.sans, fontWeight: 700, fontSize: 36, letterSpacing: "0.18em", opacity: 0.92 }}>
            <span style={{ width: 70, height: 3, background: props.style.accentColor }} />
            {region}
          </div>
        ) : null}
        <div style={{ marginTop: 28, fontFamily: FONT.serif, fontWeight: 800, fontSize: size, lineHeight: 1.22, letterSpacing: "-0.02em", textShadow: "0 4px 24px rgba(0,0,0,.4)", wordBreak: "keep-all" }}>
          {lines(text).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 정보 카드: a white card low on the photo with the hook, region and price, like a booking ad. */
const Card: React.FC<CoverProps> = ({ imageSrc, text, props }) => {
  const { product, style } = props;
  const size = fit(text, 820, 96, 56);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Photo src={imageSrc} />
      <Logo src={props.logoSrc} top={290} />
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          bottom: 330,
          padding: "56px 60px",
          borderRadius: 44,
          background: "rgba(255,255,255,.96)",
          boxShadow: "0 30px 80px rgba(0,0,0,.35)",
          fontFamily: FONT.sans,
          color: "#0f172a",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: size, lineHeight: 1.2, letterSpacing: "-0.03em", wordBreak: "keep-all" }}>
          {lines(text).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        <div style={{ marginTop: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <span style={{ color: "#5b6474" }}>{product.region ? `📍 ${product.region}` : ""}</span>
          {priceLine(product) ? <span style={{ color: style.accentColor, fontWeight: 900 }}>{priceLine(product)}</span> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 가격 강조: a big round price sticker under the hook; falls back to the hook alone without a price. */
const Price: React.FC<CoverProps> = ({ imageSrc, text, props }) => {
  const { product, style } = props;
  const price = priceLine(product);
  const size = fit(text, 920, 110, 60);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Photo src={imageSrc} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 55% at 50% 50%,rgba(0,0,0,.55) 0%,rgba(0,0,0,.15) 100%)" }} />
      <Logo src={props.logoSrc} top={290} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56, padding: "0 70px" }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 900, fontSize: size, lineHeight: 1.2, color: "#fff", textAlign: "center", letterSpacing: "-0.03em", textShadow: "0 4px 20px rgba(0,0,0,.5)", wordBreak: "keep-all" }}>
          {lines(text).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        {price ? (
          <div
            style={{
              width: 470,
              height: 470,
              borderRadius: "50%",
              background: style.accentColor,
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: "rotate(-8deg)",
              boxShadow: "0 24px 60px rgba(0,0,0,.4), inset 0 0 0 10px rgba(255,255,255,.25)",
              fontFamily: FONT.sans,
              textAlign: "center",
              padding: 40,
            }}
          >
            {product.originalPriceText ? (
              <div style={{ fontSize: 38, fontWeight: 600, opacity: 0.85, textDecoration: "line-through" }}>{product.originalPriceText}</div>
            ) : null}
            <div style={{ fontSize: fit(price, 390, 92, 48), fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.04em", wordBreak: "keep-all" }}>{price}</div>
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 감성 프레임: the photo as a tilted print on warm paper, a serif line underneath. */
const Frame: React.FC<CoverProps> = ({ imageSrc, text, props }) => {
  const size = fit(text, 880, 92, 54);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#f7f1e7,#efe5d4)" }}>
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 110,
          width: 860,
          height: 860,
          padding: 28,
          paddingBottom: 28,
          background: "#fff",
          transform: "rotate(-2.5deg)",
          boxShadow: "0 30px 60px rgba(60,40,20,.22)",
        }}
      >
        <Photo src={imageSrc} />
      </div>
      <Logo src={props.logoSrc} top={290} right={70} height={110} />
      <div style={{ position: "absolute", top: 1270, left: 90, right: 90, textAlign: "center", color: "#3a2e22" }}>
        <div style={{ fontFamily: FONT.serif, fontWeight: 800, fontSize: size, lineHeight: 1.3, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>
          {lines(text).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        {props.product.region ? (
          <div style={{ marginTop: 26, fontFamily: FONT.sans, fontWeight: 600, fontSize: 36, color: "#8a7560", letterSpacing: "0.12em" }}>
            {props.product.region}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** 위아래 분할: photo on top, a solid accent block below carrying the hook in white. */
const Split: React.FC<CoverProps> = ({ imageSrc, text, props }) => {
  const size = fit(text, 920, 112, 60);
  return (
    <AbsoluteFill style={{ background: props.style.accentColor }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1080 }}>
        <Photo src={imageSrc} />
      </div>
      <Logo src={props.logoSrc} top={290} />
      <div style={{ position: "absolute", top: 1080, left: 0, right: 0, height: 600, padding: "0 70px", display: "flex", flexDirection: "column", justifyContent: "center", color: "#fff", fontFamily: FONT.sans }}>
        <div style={{ fontWeight: 900, fontSize: size, lineHeight: 1.18, letterSpacing: "-0.03em", wordBreak: "keep-all" }}>
          {lines(text).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        {props.product.region ? <div style={{ marginTop: 26, fontSize: 40, fontWeight: 700, opacity: 0.88 }}>📍 {props.product.region}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Advance widths (em) measured from the font files' hmtx: Hangul, space, everything else. */
const COVER_FONT_METRICS: Record<CoverFont, { hangul: number; space: number; other: number }> = {
  konkon: { hangul: 0.73, space: 0.3, other: 0.5 },
  yache: { hangul: 0.63, space: 0.21, other: 0.47 },
  paperlogy: { hangul: 0.88, space: 0.22, other: 0.67 },
};

export function lineWidthEm(line: string, font: CoverFont = "konkon"): number {
  const m = COVER_FONT_METRICS[font];
  let em = 0;
  for (const ch of line) em += ch === " " ? m.space : /[가-힣ㄱ-ㆎ]/.test(ch) ? m.hangul : m.other;
  return em;
}

/** 메이 cover rule: start at 150px, shrink 4px at a time until every line fits 864px (80% width), never below 110px. */
export function mayCoverSize(text: string, font: CoverFont = "konkon"): number {
  const widest = Math.max(0.01, ...lines(text).map((l) => lineWidthEm(l, font)));
  let size = 150;
  while (size > 110 && widest * size > 864) size -= 4;
  return size;
}

/**
 * 메이 썸네일 (메이_썸네일_자막_스타일.css): two centred lines from y 470, first line in the picked colour,
 * second white, 7px black outline (paint-order keeps it behind the glyph) and a heavy black glow.
 */
const May: React.FC<CoverProps> = ({ imageSrc, text, props }) => {
  const size = mayCoverSize(text, props.style.coverFont);
  const family = fontFamilyFor(props.style.coverFont) ?? FONT.display;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Photo src={imageSrc} />
      <div style={{ position: "absolute", top: 470, left: 0, right: 0, textAlign: "center" }}>
        {lines(text)
          .slice(0, 2)
          .map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: family,
                fontSize: size,
                lineHeight: 1.16,
                whiteSpace: "nowrap",
                color: i === 0 ? props.style.coverLineColor : "#FFFFFF",
                WebkitTextStroke: "14px #000",
                paintOrder: "stroke fill",
                textShadow: "0 0 16px #000, 0 0 16px #000, 0 0 16px #000",
              }}
            >
              {line}
            </div>
          ))}
      </div>
    </AbsoluteFill>
  );
};

export const COVERS: Record<Exclude<CoverTemplate, "auto">, React.FC<CoverProps>> = {
  may: May,
  bold: Bold,
  magazine: Magazine,
  card: Card,
  price: Price,
  frame: Frame,
  split: Split,
};
