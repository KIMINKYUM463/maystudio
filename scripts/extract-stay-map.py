"""Pulls the stay ranking out of public/travel-map.html into src/lib/data/stay-map.json for the editor."""
import json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
html = (root / "public/travel-map.html").read_text(encoding="utf-8")
start = html.index("let DATA = [") + len("let DATA = ")
data, _ = json.JSONDecoder().raw_decode(html[start:])
stays = []
for row in data:
    reels = [v for v in row.get("v", []) if v.get("u")]
    if not row.get("n") or not reels:
        continue
    top = max(reels, key=lambda v: v.get("vw") or 0)
    stays.append({
        "name": row["n"],
        "region": row.get("r", ""),
        "province": row.get("p", ""),
        "type": row.get("t", ""),
        "channels": row.get("ch", 0),
        "reels": len(reels),
        "views": sum(v.get("vw") or 0 for v in reels),
        "comments": sum(v.get("cm") or 0 for v in reels),
        "latest": max(v.get("d", "") for v in reels),
        "topReel": {"url": top["u"], "views": top.get("vw") or 0, "label": top.get("l", "")},
    })
stays.sort(key=lambda s: -s["views"])
out = root / "src/lib/data/stay-map.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(stays, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(stays), "stays ->", out, out.stat().st_size, "bytes", file=sys.stderr)
