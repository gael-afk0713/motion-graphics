#!/usr/bin/env python3
"""Peixe-papagaio parte 3, sound-design review of v5: the continuous bed, the transition sweep and the
low-passed copies of every effect.

  node scripts/fx_dump.mjs out/papagaio3-fx.json src/papagaio3/sfx.ts src/papagaio3/timeline.ts src/papagaio3/words.ts
  python scripts/papagaio3_sound.py        (earshot venv python: numpy + soundfile + scipy)

1. public/papagaio3/sfx/bed.wav: one continuous underwater bed for the whole video (soft low rumble,
   low-passed at ~600 Hz, sparse distant bubbles), its timbre changing per scene with 0.4 s crossfades:
   calm lagoon = almost silence; the current (scene 4) = deeper, moving; the outer reef = livelier (a school
   flutter); the island = soft waves. RMS ~30 dB under the typical voice RMS. 0.3 s of silence right before
   "e o macho que mandava aqui" (C5_HUSH). Synthesised: a continuous bed is not in the earshot bank.
2. public/papagaio3/sfx/sweep.wav: the transition sound, a soft 0.3 s filter sweep (noise through a
   low-pass rising 250 -> 3500 Hz, swelling in and out). Synthesised (a filter sweep, not a whoosh).
3. public/papagaio3/sfx/lp/...: every effect file (earshot kit takes and the synthesised ones) low-passed at
   5 kHz (zero-phase, so nothing moves in time); the bites also as a muffled version (2.5 kHz, "_m").
"""
import glob
import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfiltfilt

SR = 48000
rng = np.random.default_rng(23)
SFX = os.path.join("public", "papagaio3", "sfx")
D = json.load(open(os.path.join("out", "papagaio3-fx.json"), encoding="utf-8"))
FPS, S, SD, DUR = D["FPS"], D["S"], D["SCENE_DURATIONS"], D["DURATION"]


def lp(x, hz, order=4):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


# --------------------------------------------------------------------------- 1. bed
n = int(DUR / FPS * SR) + SR // 2
t = np.arange(n) / SR


def rumble(cut=600, slow=0.07):
    x = lp(rng.standard_normal(n), cut)
    return x * (0.75 + 0.25 * np.sin(2 * np.pi * slow * t + rng.uniform(0, 6)))


def bubbles(rate, lo=300, hi=900, cut=2000):
    x = np.zeros(n)
    k = int(rate * n / SR)
    for _ in range(k):
        s0 = int(rng.uniform(0, n - SR * 0.06))
        L = int(rng.uniform(0.02, 0.05) * SR)
        tt = np.arange(L) / SR
        f0 = rng.uniform(lo, hi)
        x[s0 : s0 + L] += np.sin(2 * np.pi * f0 * (1 + 2.5 * tt / tt[-1]) * tt) * np.exp(-tt / 0.012) * rng.uniform(0.3, 1)
    return lp(x, cut, 2)


def waves():
    x = lp(rng.standard_normal(n), 800)
    env = 0.25 + 0.75 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.13 * t)) ** 2
    return x * env


def school():
    # a school of small fish: a soft, low flutter (filtered noise patting at 7-11 Hz)
    x = bp(rng.standard_normal(n), 300, 1400)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * (9 + 2 * np.sin(2 * np.pi * 0.21 * t)) * t)
    return x * am ** 3 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.09 * t) ** 2)


R = rumble()
RD = rumble(300, 0.6) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.6 * t) ** 2)  # deeper and moving (the current)
B_reef = bubbles(1.0)
B_lag = bubbles(0.25)
B_out = bubbles(2.2, 400, 1100)
W = waves()
F = school()
layers = [
    R * 1.0 + B_reef * 0.6,  # 1 hook, reef by day
    R * 0.22 + B_lag * 0.25 + W * 0.25,  # 2 calm lagoon: almost silence
    R * 0.35 + B_lag * 0.35,  # 3 the lagoon, hungry
    R * 0.9 + RD * 1.8 + B_reef * 0.5,  # 4 the current: deeper, moving
    R * 1.0 + B_out * 0.8 + F * 0.35,  # 5 outer reef: livelier
    R * 1.0 + B_out * 0.8 + F * 0.35,  # 6
    R * 1.0 + B_out * 0.7 + F * 0.3,  # 7
    R * 0.3 + W * 1.0 + B_lag * 0.2,  # 8 the island: soft waves
]
bed = np.zeros(n)
xf = int(0.4 * SR)
for i, L in enumerate(layers):
    a = int(S[i] / FPS * SR)
    b = int((S[i] + SD[i]) / FPS * SR) if i + 1 < len(S) else n
    w = np.zeros(n)
    w[max(0, a - xf // 2) : min(n, b + xf // 2)] = 1.0
    # crossfade ramps
    if i > 0:
        r0 = max(0, a - xf // 2)
        w[r0 : r0 + xf] = np.linspace(0, 1, xf)
    if i + 1 < len(S):
        r1 = b - xf // 2
        w[r1 : r1 + xf] = np.linspace(1, 0, xf)
    bed += L * w
# level: RMS of the reef parts ~ the typical voice RMS (-29 dBFS) minus 30 dB
voice_rms = -29.0
ref = bed[int(S[0] / FPS * SR) : int((S[0] + SD[0]) / FPS * SR)]
bed *= 10 ** ((voice_rms - 30 - rms_db(ref)) / 20)
# the key moment: 0.3 s of silence before "e o macho que mandava aqui"
h1 = int(D["C5_HUSH"] / FPS * SR)
h0 = h1 - int(0.3 * SR)
fd = int(0.03 * SR)
g = np.ones(n)
g[h0 - fd : h0] = np.linspace(1, 0, fd)
g[h0:h1] = 0
g[h1 : h1 + fd] = np.linspace(0, 1, fd)
bed *= g
fade = int(0.5 * SR)
bed[:fade] *= np.linspace(0.6, 1, fade)
bed[-fade:] *= np.linspace(1, 0, fade)
sf.write(os.path.join(SFX, "bed.wav"), np.stack([bed, bed], 1).astype(np.float32), SR, subtype="PCM_24")
print(f"bed.wav: {n / SR:.2f} s, reef RMS {rms_db(ref * 10 ** ((voice_rms - 30 - rms_db(ref)) / 20)):.1f} dBFS, hush {h0 / SR:.2f}-{h1 / SR:.2f} s")

# --------------------------------------------------------------------------- 2. sweep
dur = 0.36
m = int(dur * SR)
tt = np.arange(m) / SR
noise = rng.standard_normal(m)
cut = 250 * (3500 / 250) ** np.clip(tt / 0.3, 0, 1)  # the low-pass opening up
y = np.zeros(m)
z = 0.0
z2 = 0.0
for i in range(m):  # 2-pole one-pole cascade with a moving cutoff
    a = 1 - np.exp(-2 * np.pi * cut[i] / SR)
    z += a * (noise[i] - z)
    z2 += a * (z - z2)
    y[i] = z2
PEAK_T = 0.22
env = np.where(tt < PEAK_T, (tt / PEAK_T) ** 1.6, np.clip(1 - (tt - PEAK_T) / (dur - PEAK_T), 0, 1) ** 1.3)
sweep = y * env
sweep = sweep / (np.max(np.abs(sweep)) + 1e-9) * 10 ** (-6 / 20)
sf.write(os.path.join(SFX, "sweep.wav"), np.stack([sweep, sweep], 1).astype(np.float32), SR, subtype="PCM_24")
print(f"sweep.wav: {dur} s, peak at {PEAK_T} s")

# --------------------------------------------------------------------------- 3. low-passed copies
lp5 = butter(4, 5000, "low", fs=SR, output="sos")
lp25 = butter(4, 2500, "low", fs=SR, output="sos")
files = sorted(glob.glob(os.path.join(SFX, "kit", "*.wav"))) + [os.path.join(SFX, f) for f in ("scrape.wav", "current.wav", "sand.wav", "sweep.wav")]
out = 0
for f in files:
    x, sr = sf.read(f, always_2d=True)
    assert sr == SR, (f, sr)
    rel = os.path.relpath(f, SFX)
    dst = os.path.join(SFX, "lp", rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    sf.write(dst, sosfiltfilt(lp5, x, axis=0).astype(np.float32), SR, subtype="PCM_24")
    out += 1
    if os.path.basename(f).startswith("crack_"):
        sf.write(dst.replace(".wav", "_m.wav"), sosfiltfilt(lp25, x, axis=0).astype(np.float32), SR, subtype="PCM_24")
        out += 1
print(f"{out} low-passed files in {os.path.join(SFX, 'lp')}")
