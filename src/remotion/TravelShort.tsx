import { linearTiming, TransitionSeries, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Img, Series, useDelayRender } from "remotion";
import { carouselSlides, TRANSITION_FRAMES, type CarouselProps, type VideoProps } from "../lib/video/props";
import { Caption, CameraImage, CornerAdLabel, Logo, Overlay, Pill, PriceBadge, SAFE_TOP } from "./components";
import { ensureFonts } from "./fonts";
import { SceneView } from "./SceneView";
import { FONT, THEMES, type Theme } from "./theme";

type AnyPresentation = TransitionPresentation<Record<string, unknown>>;

function presentationFor(theme: Theme): AnyPresentation {
  if (theme.transition === "slide") return slide({ direction: "from-right" }) as AnyPresentation;
  if (theme.transition === "wipe") return wipe({ direction: "from-left" }) as AnyPresentation;
  return fade() as AnyPresentation;
}

function useFonts(): boolean {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureFonts()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle, continueRender, cancelRender]);
  return ready;
}

const Blank: React.FC = () => <AbsoluteFill style={{ backgroundColor: "#000" }} />;

export const TravelShort: React.FC<VideoProps> = ({ scenes, style, product, bgmSrc, logoSrc }) => {
  const fontsReady = useFonts();
  const theme = THEMES[style.template];
  if (!fontsReady) return <Blank />;
  const views = scenes.map((scene) => <SceneView key={scene.id} scene={scene} style={style} product={product} theme={theme} />);
  // Footage + per-scene graphics live inside each SceneView; Overlay is global motion graphics on top.
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {theme.transition === "cut" ? (
        <Series>
          {scenes.map((scene, i) => (
            <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
              {views[i]}
            </Series.Sequence>
          ))}
        </Series>
      ) : (
        <TransitionSeries>
          {scenes.map((scene, i) => (
            <React.Fragment key={scene.id}>
              {i > 0 ? (
                <TransitionSeries.Transition
                  presentation={presentationFor(theme)}
                  timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
                />
              ) : null}
              <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>{views[i]}</TransitionSeries.Sequence>
            </React.Fragment>
          ))}
        </TransitionSeries>
      )}
      {bgmSrc ? <Audio src={bgmSrc} volume={style.bgmVolume} loop /> : null}
      <Overlay style={style} theme={theme} logoSrc={logoSrc} />
    </AbsoluteFill>
  );
};

/** Benchmark reel cover: logo top-left, a bold two-line hook at ~30% height (inside the 3:4 grid crop). */
const ReviewCover: React.FC<{ imageSrc: string | null; text: string; props: VideoProps; theme: Theme }> = ({
  imageSrc,
  text,
  props,
  theme,
}) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <CameraImage src={imageSrc} camera="push-in" intensity={0} accent={props.style.accentColor} durationInFrames={1} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 45%)" }} />
    <Logo src={props.logoSrc} top={290} />
    <div style={{ position: "absolute", top: "30%", width: "100%", padding: "0 60px", transform: "translateY(-50%)" }}>
      <Caption text={text} theme={theme} size={theme.captionSize.hook} accent={props.style.accentColor} animate={false} />
    </div>
  </AbsoluteFill>
);

/** Reels cover image: first scene, static caption, price badge. */
export const Thumbnail: React.FC<VideoProps> = (props) => {
  const { scenes, style, product } = props;
  const fontsReady = useFonts();
  const theme = THEMES[style.template];
  const hook = scenes.find((s) => s.kind === "hook") ?? scenes[0];
  if (!fontsReady || !hook) return <Blank />;
  const imageSrc = hook.shots[0]?.imageSrc ?? null;
  if (theme.overlay === "corner") return <ReviewCover imageSrc={imageSrc} text={hook.caption} props={props} theme={theme} />;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <CameraImage src={imageSrc} camera="push-in" intensity={0} accent={style.accentColor} durationInFrames={1} />
      <AbsoluteFill style={{ background: theme.scrim }} />
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% 50%, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 100%)" }}
      />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", gap: 40, padding: `${SAFE_TOP}px 70px` }}
      >
        <Caption
          text={hook.caption}
          theme={theme}
          size={theme.captionSize.hook + 8}
          accent={style.accentColor}
          animate={false}
        />
        {product.region ? (
          <Pill background="rgba(0,0,0,0.45)" size={40}>
            📍 {product.region}
          </Pill>
        ) : null}
        {style.showPriceBadge ? <PriceBadge product={product} accent={style.accentColor} animate={false} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SLIDE_SHADOW = "0 0 8px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.5)";

/**
 * One 4:5 carousel slide, laid out like the benchmark: cover = dark bottom gradient, "*" and a bold
 * two-line hook; story slides = 2~3 lines of plain white text; the rest are photo-only.
 */
export const CarouselSlideStill: React.FC<CarouselProps> = (props) => {
  const fontsReady = useFonts();
  const slide = carouselSlides(props)[props.slideIndex];
  if (!fontsReady || !slide) return <Blank />;
  const { style } = props;
  const isCover = slide.variant === "cover";
  const textTop = style.captionPosition === "top" ? "14%" : style.captionPosition === "center" ? "50%" : "74%";
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {slide.imageSrc ? (
        <Img src={slide.imageSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <CameraImage src={null} camera="push-in" intensity={0} accent={style.accentColor} durationInFrames={1} />
      )}
      {isCover ? (
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)" }} />
      ) : null}
      <Logo src={props.logoSrc} height={120} top={40} left={40} />
      {style.showAdLabel ? <CornerAdLabel top={48} size={26} /> : null}
      {slide.text ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            padding: "0 70px",
            ...(isCover ? { bottom: 110 } : { top: textTop, transform: "translateY(-50%)" }),
            color: "#fff",
            textAlign: "center",
            fontFamily: FONT.sans,
            fontWeight: isCover ? 800 : 700,
            fontSize: isCover ? 74 : 54,
            lineHeight: 1.32,
            letterSpacing: "-0.02em",
            wordBreak: "keep-all",
            whiteSpace: "pre-line",
            textShadow: SLIDE_SHADOW,
          }}
        >
          {isCover ? <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 18 }}>*</div> : null}
          {slide.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
