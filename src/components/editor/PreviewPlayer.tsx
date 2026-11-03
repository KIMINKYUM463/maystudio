"use client";

import { Player } from "@remotion/player";
import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH, videoDurationInFrames, type VideoProps } from "@/lib/video/props";
import { TravelShort } from "@/remotion/TravelShort";

/** Live preview of the exact composition the render worker uses. Client-only (loaded via next/dynamic). */
export default function PreviewPlayer({ props }: { props: VideoProps }) {
  return (
    <Player
      component={TravelShort}
      inputProps={props}
      durationInFrames={videoDurationInFrames(props)}
      compositionWidth={VIDEO_WIDTH}
      compositionHeight={VIDEO_HEIGHT}
      fps={FPS}
      controls
      loop
      clickToPlay
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: "9 / 16", borderRadius: 20, overflow: "hidden" }}
    />
  );
}
