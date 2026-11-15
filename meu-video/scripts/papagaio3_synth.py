#!/usr/bin/env python3
"""Peixe-papagaio parte 3: the only sounds synthesised by hand, because the earshot bank has nothing for
them (briefing: "síntese só para o que o banco não tem"): the beak scraping dead rock ("scrape"), the
strong current at the reef edge ("current": rushing water + a gust) and the sand pouring and piling up
("sand"). Everything else comes from the earshot kit. Writes public/papagaio3/sfx/*.wav (48 kHz, 24-bit).

  python scripts/papagaio3_synth.py      (earshot venv python: numpy + soundfile + scipy)
"""
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(31)
OUT = os.path.join("public", "papagaio3", "sfx")
os.makedirs(OUT, exist_ok=True)


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def norm(x, peak_db):
    x = x - np.mean(x)
    return x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)


def fade(x, a=0.003, r=0.08):
    n = len(x)
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] = np.linspace(1, 0, nr)
    return x * e


# --- scrape: one dry, gritty stroke of the beak on dead rock (0.45 s), sharp attack for the sync ---
dur = 0.45
n = int(dur * SR)
t = np.arange(n) / SR
grit = bp(rng.standard_normal(n), 900, 5200)
# stick-slip: fast irregular pulses, like hard enamel dragged over stone
rate = 55 + 25 * np.sin(2 * np.pi * 3 * t)
ph = np.cumsum(rate) / SR
stick = (0.35 + 0.65 * np.abs(np.sin(np.pi * ph)) ** 6)
body = bp(rng.standard_normal(n), 250, 900) * 0.4
env = np.minimum(1, t / 0.004) * np.exp(-t * 2.2) * (1 - np.clip((t - 0.36) / 0.09, 0, 1))
scrape = (grit * stick + body) * env
sf.write(os.path.join(OUT, "scrape.wav"), fade(norm(scrape, -6), a=0.001, r=0.05), SR, subtype="PCM_24")

# --- current: a continuous, low, deep flow of water (2.4 s): no clicks, no gust, no impact. Soft swell
#     in (0.15 s), steady, slowly fading. Only filtered noise with a slow, smooth movement.
dur = 2.4
n = int(dur * SR)
t = np.arange(n) / SR
flow = lp(rng.standard_normal(n), 420, order=4)
deep = lp(rng.standard_normal(n), 140, order=4) * 1.8
move = 0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t + 0.4) + 0.08 * np.sin(2 * np.pi * 1.9 * t)
env = np.minimum(1, t / 0.15) ** 2 * (1 - 0.5 * np.clip((t - 1.0) / 1.4, 0, 1))
current = (flow + deep) * move * env
sf.write(os.path.join(OUT, "current.wav"), fade(norm(current, -6), a=0.01, r=0.5), SR, subtype="PCM_24")

# --- sand: fine grains pouring and settling, a soft hiss with tiny ticks (2.2 s) ---
dur = 2.2
n = int(dur * SR)
t = np.arange(n) / SR
hiss = hp(rng.standard_normal(n), 3000) * 0.25
ticks = np.zeros(n)
for k in range(900):
    s = int(rng.uniform(0, dur - 0.003) * SR)
    ticks[s] += rng.uniform(-1, 1)
ticks = bp(ticks, 2000, 9000) * 3
env = np.minimum(1, t / 0.03) * (0.6 + 0.4 * np.sin(np.pi * np.clip(t / dur, 0, 1)))
sand = (hiss + ticks) * env
sf.write(os.path.join(OUT, "sand.wav"), fade(norm(sand, -12), a=0.002, r=0.4), SR, subtype="PCM_24")
print("wrote scrape.wav, current.wav, sand.wav in", OUT)
