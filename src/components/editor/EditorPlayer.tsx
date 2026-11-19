"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { FPS, VIDEO_HEIGHT, VIDEO_WIDTH, videoDurationInFrames, type VideoProps } from "@/lib/video/props";
import { TravelShort } from "@/remotion/TravelShort";

export type EditorPlayerHandle = { seekTo: (frame: number) => void; toggle: () => void };

/** Video-editor preview: the render composition, reporting its frame so the timeline playhead follows it. */
const EditorPlayer = forwardRef<EditorPlayerHandle, { props: VideoProps; onFrame: (frame: number) => void; onPlaying: (playing: boolean) => void }>(
  function EditorPlayer({ props, onFrame, onPlaying }, ref) {
    const player = useRef<PlayerRef>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (frame) => player.current?.seekTo(frame),
      toggle: () => player.current?.toggle(),
    }));

    useEffect(() => {
      const p = player.current;
      if (!p) return;
      const onUpdate = (e: { detail: { frame: number } }) => onFrame(e.detail.frame);
      const onPlay = () => onPlaying(true);
      const onPause = () => onPlaying(false);
      p.addEventListener("frameupdate", onUpdate);
      p.addEventListener("seeked", onUpdate);
      p.addEventListener("play", onPlay);
      p.addEventListener("pause", onPause);
      return () => {
        p.removeEventListener("frameupdate", onUpdate);
        p.removeEventListener("seeked", onUpdate);
        p.removeEventListener("play", onPlay);
        p.removeEventListener("pause", onPause);
      };
    }, [onFrame, onPlaying]);

    return (
      <Player
        ref={player}
        component={TravelShort}
        inputProps={props}
        durationInFrames={videoDurationInFrames(props)}
        compositionWidth={VIDEO_WIDTH}
        compositionHeight={VIDEO_HEIGHT}
        fps={FPS}
        loop
        clickToPlay
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: "9 / 16" }}
      />
    );
  },
);

export default EditorPlayer;
