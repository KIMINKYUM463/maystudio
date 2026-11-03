import { Easing, interpolate } from "remotion";
import type { CameraMove } from "../lib/types";

export type CameraTransform = { scale: number; x: number; y: number };

/**
 * Ken Burns style motion. `progress` runs 0→1 over the scene; x/y are
 * percentages of the frame. Base scale stays > 1 so pans never reveal edges.
 */
export function cameraTransform(move: CameraMove, progress: number, intensity: number): CameraTransform {
  const t = interpolate(progress, [0, 1], [0, 1], {
    easing: Easing.bezier(0.33, 0, 0.2, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const base = 1 + intensity;
  const travel = intensity * 40;
  switch (move) {
    case "push-in":
      return { scale: 1.02 + intensity * t * 1.4, x: 0, y: 0 };
    case "pull-out":
      return { scale: 1.02 + intensity * (1 - t) * 1.4, x: 0, y: 0 };
    case "pan-left":
      return { scale: base, x: travel / 2 - travel * t, y: 0 };
    case "pan-right":
      return { scale: base, x: -travel / 2 + travel * t, y: 0 };
    case "tilt-up":
      return { scale: base, x: 0, y: -travel / 2 + travel * t };
    case "tilt-down":
      return { scale: base, x: 0, y: travel / 2 - travel * t };
    case "drift":
      return { scale: base + intensity * 0.4 * t, x: -travel / 4 + (travel / 2) * t, y: travel / 8 - (travel / 4) * t };
  }
}

export const CAMERA_LABELS: Record<CameraMove, string> = {
  "push-in": "줌 인",
  "pull-out": "줌 아웃",
  "pan-left": "왼쪽 패닝",
  "pan-right": "오른쪽 패닝",
  "tilt-up": "위로 틸트",
  "tilt-down": "아래로 틸트",
  drift: "드리프트",
};
