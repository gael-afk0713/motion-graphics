#!/usr/bin/env python3
"""Tile PNG stills into one contact sheet with the frame number under each one.
  python scripts/contact_sheet.py <dir> <out.png> [cols] [label ...]
(labels, if given, replace the file names in order)"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
labels = sys.argv[4:]
files = sorted(glob.glob(os.path.join(d, "*.png")))
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
pad = 34
sheet = Image.new("RGB", (cols * w, ((len(ims) + cols - 1) // cols) * (h + pad)), "#111")
dr = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("arialbd.ttf", 24)
except OSError:
    font = ImageFont.load_default()
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * (h + pad)
    sheet.paste(im, (x, y))
    lab = labels[i] if i < len(labels) else os.path.basename(f)[1:-4].lstrip("0") or "0"
    dr.text((x + 8, y + h + 4), lab, fill="#ffd23f", font=font)
sheet.save(out)
print(out, sheet.size)
