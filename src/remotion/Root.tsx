import React from "react";
import { Composition, Still } from "remotion";
import { styleSchema } from "../lib/types";
import {
  CAROUSEL_HEIGHT,
  CAROUSEL_WIDTH,
  FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  videoDurationInFrames,
  type CarouselProps,
  type VideoProps,
} from "../lib/video/props";
import { CarouselSlideStill, Thumbnail, TravelShort } from "./TravelShort";

export const COMPOSITION_ID = "TravelShort";
export const THUMBNAIL_ID = "Thumbnail";
export const CAROUSEL_ID = "CarouselSlide";

const demoProps: VideoProps = {
  style: styleSchema.parse({ watermark: "@maystudio" }),
  product: {
    name: "오션뷰 감성 스테이",
    region: "강원 강릉",
    priceText: "1박 89,000원~",
    originalPriceText: "129,000원",
    rating: "4.8",
    features: ["통창 오션뷰", "개별 바베큐", "스파 욕조"],
  },
  bgmSrc: null,
  logoSrc: null,
  photos: [],
  scenes: [
    { id: "hook", kind: "hook", shots: [], caption: "강릉에서 1박 8만원대?\n이 퀄리티 실화", subCaption: "📍 강원 강릉", narration: "", camera: "push-in", durationInFrames: 84, audioSrc: null },
    { id: "f1", kind: "feature", shots: [], caption: "창밖이 그냥 그림", subCaption: "오션뷰", narration: "", camera: "pan-right", durationInFrames: 96, audioSrc: null },
    { id: "romance", kind: "romance", shots: [], caption: "파도 소리 들으며\n아무것도 안 하는 하루", subCaption: "", narration: "", camera: "drift", durationInFrames: 132, audioSrc: null },
    { id: "cta", kind: "cta", shots: [], caption: "정보는 댓글에\n'쉼' 남겨주세요", subCaption: "DM으로 바로 보내드려요", narration: "", camera: "pull-out", durationInFrames: 90, audioSrc: null },
  ],
};

const demoCarouselProps: CarouselProps = { ...demoProps, slideIndex: 0 };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id={COMPOSITION_ID}
      component={TravelShort}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      durationInFrames={videoDurationInFrames(demoProps)}
      defaultProps={demoProps}
      calculateMetadata={({ props }) => ({ durationInFrames: videoDurationInFrames(props) })}
    />
    <Still id={THUMBNAIL_ID} component={Thumbnail} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} defaultProps={demoProps} />
    <Still
      id={CAROUSEL_ID}
      component={CarouselSlideStill}
      width={CAROUSEL_WIDTH}
      height={CAROUSEL_HEIGHT}
      defaultProps={demoCarouselProps}
    />
  </>
);
