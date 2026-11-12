#!/usr/bin/env python3
"""Peixe-papagaio parte 2: the only effects synthesised by hand (the earshot bank has nothing good for
them): the slime oozing ("goo": soft viscous bubbles) and the hungry belly ("growl"). Everything else
comes from the earshot kit. Writes public/papagaio2/sfx/{goo,growl}.wav (48 kHz, 24-bit).

  python scripts/papagaio2_synth.py      (earshot venv python: numpy + soundfile + scipy)
"""
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(7)
OUT = os.path.join("public", "papagaio2", "sfx")
os.makedirs(OUT, exist_ok=True)


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def norm(x, peak_db):
    x = x - np.mean(x)
    return x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)


def fade(x, a=0.004, r=0.08):
    n = len(x)
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] = np.linspace(1, 0, nr)
    return x * e


# --- goo: wet, viscous little bubbles over a soft sticky bed (2.6 s) ---
dur = 2.6
n = int(dur * SR)
t = np.arange(n) / SR
bed = lp(rng.standard_normal(n), 900) * (0.35 + 0.25 * np.sin(2 * np.pi * 1.7 * t) ** 2)
goo = bed * 0.25
for k in range(26):
    t0 = 0.03 + k * 0.095 + rng.uniform(-0.03, 0.03)
    L = rng.uniform(0.045, 0.09)
    m = int(L * SR)
    s = int(t0 * SR)
    if s + m >= n:
        break
    tt = np.arange(m) / SR
    f0, f1 = rng.uniform(180, 320), rng.uniform(380, 650)
    ph = 2 * np.pi * np.cumsum(f0 + (f1 - f0) * (tt / L) ** 0.6) / SR
    blorp = np.sin(ph) * np.exp(-tt / (L * 0.35)) * (1 - np.exp(-tt / 0.002))
    goo[s : s + m] += blorp * rng.uniform(0.4, 1.0)
goo = lp(goo, 2200)
sf.write(os.path.join(OUT, "goo.wav"), fade(norm(goo, -10)), SR, subtype="PCM_24")

# --- growl: a funny rumbling belly (1.15 s), sharp start for the sync ---
dur = 1.15
n = int(dur * SR)
t = np.arange(n) / SR
f = 78 + 30 * np.sin(2 * np.pi * 1.3 * t) + 18 * np.sin(2 * np.pi * 4.1 * t + 1) + 8 * lp(rng.standard_normal(n), 12) * 40
ph = 2 * np.pi * np.cumsum(f) / SR
tone = sum(np.sin(h * ph) / h ** 1.1 for h in range(1, 9))
gurgle = bp(rng.standard_normal(n), 120, 700) * 0.6
am = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * (9 + 5 * np.sin(2 * np.pi * 0.9 * t)) * t)) ** 1.5
env = np.minimum(1, t / 0.012) * (0.75 + 0.25 * np.sin(2 * np.pi * 2.2 * t + 0.5)) * np.exp(-t * 0.6)
env[int(0.62 * SR) : int(0.7 * SR)] *= np.linspace(1, 0.35, int(0.08 * SR))
env[int(0.7 * SR) :] *= 0.35 + 0.65 * np.minimum(1, (t[int(0.7 * SR) :] - 0.7) / 0.05)
growl = lp((tone * 0.7 + gurgle) * am * env, 1400)
sf.write(os.path.join(OUT, "growl.wav"), fade(norm(growl, -4), a=0.002, r=0.15), SR, subtype="PCM_24")
print("wrote", os.path.join(OUT, "goo.wav"), os.path.join(OUT, "growl.wav"))
