const POSTER_AT_SEC = 0.5;
const POSTER_TIMEOUT_MS = 15_000;

function waitFor(video: HTMLVideoElement, event: "loadeddata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("영상을 읽는 데 시간이 너무 오래 걸려요.")), POSTER_TIMEOUT_MS);
    video.addEventListener(event, () => (clearTimeout(timer), resolve()), { once: true });
    video.addEventListener("error", () => (clearTimeout(timer), reject(new Error("브라우저가 읽을 수 없는 영상이에요. (MP4 H.264 권장)"))), {
      once: true,
    });
  });
}

/**
 * Grabs one frame of an uploaded clip as its still photo (cover, carousel, fallback when the
 * clip is shorter than its cut). Runs in the browser, which already decodes MP4/WebM.
 */
export async function videoPoster(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await waitFor(video, "loadeddata");
    video.currentTime = Math.min(POSTER_AT_SEC, (video.duration || 1) / 2);
    await waitFor(video, "seeked");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("영상에서 대표 사진을 만들지 못했어요.");
    return blob;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
