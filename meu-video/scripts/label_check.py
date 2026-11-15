#!/usr/bin/env python3
"""Measure the big on-screen labels in rendered stills: horizontal centre, width and tilt.

  python scripts/label_check.py <stills dir> <spec.json> [--scale 0.5]

spec.json: [{"frame": 45, "label": "MUDA DE SEXO", "mode": "yellow", "y": [250, 620]}, ...]
  y is in full-frame pixels (1080x1920); the still may be rendered at a smaller --scale.
  mode: yellow = the channel's #FFD23F, red = #ff3b3b, green = the check #2fd25e plus yellow,
        ink = the black outline #0b1c22 (for white text, which would blend with a light background).
Per label: the bounding box of those pixels in the band -> centre x (target 540 +/- 4 px), width
(max 760 px) and tilt: the slope of the BASELINE of the last line of text (the bottom edge of its
leftmost 20% of columns vs its rightmost 20%), which is flat when the label is not rotated. Accents
and lines of different widths do not bias it. "tilt": false skips it (shapes with no common baseline).
Exits 1 if any label is off.
"""
import json
import math
import sys

import numpy as np
from PIL import Image

args = sys.argv[1:]
scale = 0.5
if "--scale" in args:
    i = args.index("--scale")
    scale = float(args[i + 1])
    del args[i : i + 2]
folder, spec_path = args
spec = json.load(open(spec_path, encoding="utf-8"))


def mask(img, mode):
    r, g, b = (img[..., k].astype(int) for k in range(3))
    yellow = (abs(r - 255) <= 14) & (abs(g - 210) <= 16) & (b <= 100)
    if mode == "yellow":
        return yellow
    if mode == "red":
        return (r >= 225) & (g <= 90) & (b <= 90)
    if mode == "green":
        return yellow | ((abs(r - 47) <= 30) & (abs(g - 210) <= 30) & (abs(b - 94) <= 35))
    if mode == "ink":
        return (r <= 40) & (g <= 50) & (b <= 60)
    raise ValueError(mode)


ok_all = True
print(f"{'frame':>5}  {'rotulo':<28} {'centro x':>8} {'desvio':>7} {'largura':>8} {'inclin.':>8}  resultado")
for s in spec:
    img = np.asarray(Image.open(f"{folder}/f{s['frame']:04d}.png").convert("RGB"))
    y0, y1 = (int(v * scale) for v in s["y"])
    m = mask(img[y0:y1], s["mode"])
    ys, xs = np.nonzero(m)
    if len(xs) < 20:
        print(f"{s['frame']:>5}  {s['label']:<28} nada encontrado")
        ok_all = False
        continue
    # ignore stray pixels: keep the columns between the 0.2% and 99.8% quantiles
    lo, hi = np.quantile(xs, [0.002, 0.998])
    keep = (xs >= lo) & (xs <= hi)
    xs, ys = xs[keep], ys[keep]
    x0, x1 = xs.min() / scale, (xs.max() + 1) / scale
    cx = (x0 + x1) / 2
    w = x1 - x0
    tilt = 0.0
    if s.get("tilt", True):
        ymax, ymin = ys.max(), ys.min()
        low = ys >= ymax - 0.25 * (ymax - ymin)  # the last line, near its baseline
        bx, by = xs[low], ys[low]
        a, b = np.quantile(bx, [0.2, 0.8])
        L, R = bx <= a, bx >= b
        if L.sum() > 5 and R.sum() > 5:
            dy = np.quantile(by[R], 0.98) - np.quantile(by[L], 0.98)
            dx = bx[R].mean() - bx[L].mean()
            tilt = -math.degrees(math.atan2(dy, dx))
    tol = s.get("tol", 4)
    good = abs(cx - 540) <= tol and w <= 760 + 1 and abs(tilt) <= 0.5
    if s.get("only_width"):
        good = w <= 760 + 1 and abs(tilt) <= 0.5
    ok_all &= good
    print(f"{s['frame']:>5}  {s['label']:<28} {cx:8.1f} {cx - 540:+7.1f} {w:8.0f} {tilt:+7.2f}g  {'OK' if good else 'FORA'}")
sys.exit(0 if ok_all else 1)
