"""
Finds faces with OpenCV's YuNet (scripts/models/face_detection_yunet_2023mar.onnx, MIT, opencv_zoo).
Usage: python scripts/detect-faces.py <image> [<image> ...]
Prints JSON: {"results": [{"faces": [[ymin, xmin, ymax, xmax], ...]}, ...]} with 0~1000 coordinates,
one entry per image in the same order. Called by src/lib/server/face-blur.ts.
"""
import json
import os
import sys

import cv2
import numpy as np

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "face_detection_yunet_2023mar.onnx")
WORK = 1280  # long side the detector sees; keeps small faces in wide shots findable
SCORE = 0.6


def iou(a, b):
    ax2, ay2, bx2, by2 = a[0] + a[2], a[1] + a[3], b[0] + b[2], b[1] + b[3]
    iw = max(0, min(ax2, bx2) - max(a[0], b[0]))
    ih = max(0, min(ay2, by2) - max(a[1], b[1]))
    inter = iw * ih
    return inter / (a[2] * a[3] + b[2] * b[3] - inter + 1e-9)


def faces_in(path):
    data = np.fromfile(path, dtype=np.uint8)  # handles non-ASCII paths on Windows
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        return []
    h, w = img.shape[:2]
    scale = min(1.0, WORK / max(w, h))
    small = cv2.resize(img, (max(1, int(w * scale)), max(1, int(h * scale))))
    boxes = []
    # Also run mirrored: profiles facing one way are found more reliably than the other.
    for flip in (False, True):
        src = cv2.flip(small, 1) if flip else small
        det = cv2.FaceDetectorYN.create(MODEL, "", (src.shape[1], src.shape[0]), SCORE, 0.3, 5000)
        _, found = det.detect(src)
        for r in found if found is not None else []:
            x, y, bw, bh = (float(v) / scale for v in r[:4])
            if flip:
                x = w - x - bw
            box = (x, y, bw, bh)
            if all(iou(box, b) < 0.3 for b in boxes):
                boxes.append(box)
    return [
        [round(y / h * 1000), round(x / w * 1000), round((y + bh) / h * 1000), round((x + bw) / w * 1000)]
        for x, y, bw, bh in boxes
    ]


if __name__ == "__main__":
    print(json.dumps({"results": [{"faces": faces_in(p)} for p in sys.argv[1:]]}))
