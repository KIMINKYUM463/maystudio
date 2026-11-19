"use client";

import { Thumbnail as Still } from "@remotion/player";
import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH, type VideoProps } from "@/lib/video/props";
import { Thumbnail } from "@/remotion/TravelShort";

/** Live cover still from the same component the renderer uses. Client-only (loaded via next/dynamic). */
export default function CoverPreview({ props }: { props: VideoProps }) {
  return (
    <Still
      component={Thumbnail}
      inputProps={props}
      compositionWidth={VIDEO_WIDTH}
      compositionHeight={VIDEO_HEIGHT}
      frameToDisplay={0}
      durationInFrames={1}
      fps={FPS}
      style={{ width: "100%", aspectRatio: "9 / 16" }}
    />
  );
}
