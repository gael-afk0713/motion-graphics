"""Galaxy growth stages for the Curiosário outro.

Reads public/brand/logo-pixel-80-transparente.png, isolates the galaxy
(everything that is not roots, trunk/branches, planet or the cream sparkles),
and builds smaller pixel-art versions of it: area-average downscale
(alpha-weighted), alpha threshold, then each colour snapped to the logo
palette. The last stage is the original galaxy, unchanged.

Usage: python3 -I scripts/galaxy_stages.py <out.ts> [preview.png]
"""
import json, sys
from collections import deque
from PIL import Image
import numpy as np

SRC = "public/brand/logo-pixel-80-transparente.png"
WIDTHS = [17, 20, 24, 28, 33, 38, 44]  # + the original (49 wide)
# Below 17 squares the area-average turns into a blob, so the two smallest
# stages are drawn by hand: yellow core + 2 spiral arms (pink near the core,
# purple outside). Letters = GALAXY_PALETTE indices (see the generated file):
# d/e/g purples, h/i/j pinks, l coral, m orange, k cream core.
def _hand(w, h, core, arm):
    """core squares + arm A; arm B is arm A rotated 180 degrees about the centre."""
    g = [["."] * w for _ in range(h)]
    for x, y, c in core + arm:
        g[y][x] = c
    for x, y, c in arm:
        g[h - 1 - y][w - 1 - x] = c
    return ["".join(r) for r in g]

HAND = [
    _hand(11, 7,
          [(4, 3, "m"), (5, 3, "k"), (6, 3, "m"), (5, 2, "l"), (5, 4, "l"), (6, 2, "j"), (4, 4, "j")],
          [(7, 3, "l"), (8, 2, "j"), (8, 1, "i"), (7, 0, "h"), (6, 0, "g"), (5, 0, "g"), (4, 0, "e"),
           (3, 0, "e"), (2, 1, "e")]),
    _hand(14, 9,
          [(6, 4, "k"), (7, 4, "k"), (5, 4, "m"), (8, 4, "m"), (6, 3, "m"), (7, 3, "l"), (7, 5, "m"),
           (6, 5, "l"), (8, 3, "j"), (5, 5, "j")],
          [(9, 3, "l"), (10, 2, "j"), (10, 1, "i"), (9, 2, "i"), (9, 0, "h"), (8, 0, "g"), (7, 0, "g"),
           (6, 0, "e"), (5, 0, "e"), (4, 1, "e"), (3, 1, "e"), (2, 2, "d"), (2, 3, "d")]),
]
CREAM = (249, 230, 164)
BROWNS = {(178, 91, 46), (134, 61, 35), (80, 34, 24)}
CORE = (38.5, 28.0)

im = np.array(Image.open(SRC).convert("RGBA"))
H, W = im.shape[:2]
px = {(x, y): tuple(int(c) for c in im[y, x, :3]) for y in range(H) for x in range(W) if im[y, x, 3] >= 128}
N8 = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b]

# planet: 8-connected component (within the top-right area) of the brown ring pixels
top = {k for k in px if k[1] <= 20 and k[0] >= 50}
seed = next(k for k in sorted(top) if px[k] in BROWNS)
planet, q = {seed}, deque([seed])
while q:
    x, y = q.popleft()
    for dx, dy in N8:
        n = (x + dx, y + dy)
        if n in top and n not in planet:
            planet.add(n); q.append(n)

def kind(k):
    r, g, b = px[k]
    if k in planet: return "planet"
    if g > 200 and g > r + 30: return "root"  # aqua + light-mint tips
    if px[k] in BROWNS: return "trunk"
    if px[k] == CREAM and np.hypot(k[0] + .5 - CORE[0], k[1] + .5 - CORE[1]) > 8: return "sparkle"
    return "galaxy"

gal_all = {k: c for k, c in px.items() if kind(k) == "galaxy"}
# loose dots (8-connected groups of <= 3 pixels) are "dust": they pop in last
comp = {}
for k in gal_all:
    if k in comp: continue
    grp, q = [k], deque([k]); comp[k] = grp
    while q:
        x, y = q.popleft()
        for dx, dy in N8:
            n = (x + dx, y + dy)
            if n in gal_all and n not in comp:
                comp[n] = grp; grp.append(n); q.append(n)
gal = {k: c for k, c in gal_all.items() if len(comp[k]) > 3}
dust = sorted(k for k in gal_all if len(comp[k]) <= 3)
gx0 = min(x for x, _ in gal); gx1 = max(x for x, _ in gal) + 1
gy0 = min(y for _, y in gal); gy1 = max(y for _, y in gal) + 1
GW, GH = gx1 - gx0, gy1 - gy0
palette = sorted(set(gal.values()))

crop = np.zeros((GH, GW, 4))
for (x, y), c in gal.items():
    crop[y - gy0, x - gx0] = (*c, 255)

def snap(rgb):
    p = np.array(palette, float)
    return palette[int(np.argmin(((p - rgb) ** 2).sum(1)))]

def downscale(w):
    h = max(1, round(w * GH / GW))
    out = [[None] * w for _ in range(h)]
    for j in range(h):
        for i in range(w):
            # exact area average of the source cells covered by this target cell
            xa, xb = i * GW / w, (i + 1) * GW / w
            ya, yb = j * GH / h, (j + 1) * GH / h
            acc = np.zeros(4); area = 0.0
            for y in range(int(ya), int(np.ceil(yb))):
                for x in range(int(xa), int(np.ceil(xb))):
                    a = (min(xb, x + 1) - max(xa, x)) * (min(yb, y + 1) - max(ya, y))
                    if a <= 0: continue
                    al = crop[y, x, 3] / 255
                    acc[:3] += crop[y, x, :3] * al * a
                    acc[3] += al * a
                    area += a
            cov = acc[3] / area
            if cov >= 0.5:
                out[j][i] = snap(acc[:3] / acc[3])
    return out

stages = [downscale(w) for w in WIDTHS]
stages.append([[gal.get((gx0 + i, gy0 + j)) for i in range(GW)] for j in range(GH)])

letters = "abcdefghijklmnop"
stages = [[[None if ch == "." else palette[letters.index(ch)] for ch in row] for row in g] for g in HAND] + stages

def to_rows(g):
    idx = {c: i for i, c in enumerate(palette)}
    return ["".join("." if c is None else "abcdefghijklmnop"[idx[c]] for c in row) for row in g]

out_ts = sys.argv[1]
with open(out_ts, "w") as f:
    f.write("// GENERATED by scripts/galaxy_stages.py — do not edit by hand.\n")
    f.write("// Galaxy growth stages: each row string = one row of squares,\n")
    f.write("// '.' = empty, a.. = index into GALAXY_PALETTE. Last stage = the PNG's galaxy.\n")
    f.write(f"export const GALAXY_BOX = {json.dumps(dict(x0=gx0, y0=gy0, w=GW, h=GH))};\n")
    f.write(f"export const GALAXY_DUST: [number, number][] = {json.dumps(dust)};\n")
    f.write(f"export const GALAXY_PALETTE = {json.dumps(['rgb(%d,%d,%d)' % c for c in palette])};\n")
    f.write("export const GALAXY_STAGES: string[][] = " + json.dumps([to_rows(g) for g in stages], indent=1) + ";\n")
print("dust", len(dust), "galaxy box", gx0, gy0, GW, GH, "palette", len(palette), "stages", [len(s[0]) for s in stages])

if len(sys.argv) > 2:
    # preview: all stages side by side, same square size, on the night-blue background
    S, pad = 8, 24
    tw = sum(len(s[0]) * S + pad for s in stages) + pad
    th = GH * S + 2 * pad + 30
    img = Image.new("RGB", (tw, th), (6, 12, 40))
    x = pad
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for s in stages:
        h, w = len(s), len(s[0])
        y = pad + (GH - h) * S // 2
        for j in range(h):
            for i in range(w):
                if s[j][i]:
                    d.rectangle([x + i * S, y + j * S, x + (i + 1) * S - 1, y + (j + 1) * S - 1], fill=s[j][i])
        d.text((x, th - 26), f"{w}x{h}", fill=(255, 255, 255))
        x += w * S + pad
    img.save(sys.argv[2])
