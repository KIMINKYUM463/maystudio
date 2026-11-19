"use client";

import { Player } from "@remotion/player";
import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH, videoDurationInFrames, type VideoProps } from "@/lib/video/props";
import { TravelShort } from "@/remotion/TravelShort";

/** A real frame of the reel (the render composition itself), paused or looping — used for look previews. */
export default function FramePreview({ props, frame = 45, playing = false }: { props: VideoProps; frame?: number; playing?: boolean }) {
  const duration = videoDurationInFrames(props);
  return (
    <Player
      component={TravelShort}
      inputProps={props}
      durationInFrames={duration}
      compositionWidth={VIDEO_WIDTH}
      compositionHeight={VIDEO_HEIGHT}
      fps={FPS}
      initialFrame={Math.min(frame, duration - 1)}
      autoPlay={playing}
      loop={playing}
      controls={playing}
      clickToPlay={false}
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: "9 / 16" }}
    />
  );
}
