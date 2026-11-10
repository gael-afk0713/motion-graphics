#!/usr/bin/env python3
"""Synthesises every sound effect of "Peixe-papagaio" (no samples, no copyrighted audio).
Run from meu-video/:  python3 scripts/papagaio_sfx.py
Levels are baked in (the narration peaks around -11 dBFS, mean -27 dBFS)."""
import os, wave
import numpy as np

SR = 44100
OUT = "public/papagaio/sfx"
os.makedirs(OUT, exist_ok=True)
rs = np.random.RandomState(7)

def t(d): return np.arange(int(SR * d)) / SR
def noise(d): return rs.randn(int(SR * d))
def band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = 1 / (1 + (lo / np.maximum(f, 1e-6)) ** 6) / (1 + (f / hi) ** 6)
    return np.fft.irfft(X * m, len(x))
def fade(x, a=0.005, r=0.02):
    n = len(x); e = np.ones(n)
    ia, ir = min(n // 2, int(SR * a)), min(n // 2, int(SR * r))
    if ia: e[:ia] = np.linspace(0, 1, ia)
    if ir: e[-ir:] *= np.linspace(1, 0, ir)
    return x * e
def save(name, x, peak_db):
    x = x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print(f"{name}.wav  {len(x)/SR:.2f}s  peak {peak_db} dB")
def blips(d, n, f0=(300, 900), dur=(0.03, 0.09), seed=1):
    r = np.random.RandomState(seed); x = np.zeros(int(SR * d))
    for _ in range(n):
        dd = r.uniform(*dur); tt = t(dd); f = r.uniform(*f0)
        b = np.sin(2 * np.pi * (f * tt + f * 0.9 * tt * tt / dd)) * np.exp(-tt / (dd * 0.4)) * r.uniform(0.3, 1)
        i = r.randint(0, len(x) - len(b)); x[i:i + len(b)] += fade(b, 0.003, 0.01)
    return x

# underwater bed: slow muffled rumble + sparse bubbles (whole video, far below the voice)
d = 62
amb = band(noise(d), 40, 420) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.13 * t(d)) + 0.12 * np.sin(2 * np.pi * 0.31 * t(d) + 1))
amb = amb / np.abs(amb).max() + 0.22 * blips(d, 150, seed=3) / 1.0
save("ambience", fade(amb, 0.3, 0.3), -30)

# whoosh (cuts / pops): band-passed noise sweep, peak at 0.3 s
tt = t(0.6); e = np.exp(-((tt - 0.3) / 0.11) ** 2)
x = noise(0.6); X = sum(band(x * np.exp(-((tt - c) / 0.07) ** 2), lo, hi) for c, lo, hi in [(0.18, 250, 900), (0.3, 500, 2500), (0.4, 1200, 5000)])
save("whoosh", fade(X * e), -20)

# crack: the beak hits the coral (click + stony crunch)
tt = t(0.45)
x = band(noise(0.45), 700, 7000) * np.exp(-tt / 0.035) + 0.8 * band(noise(0.45), 150, 1200) * np.exp(-tt / 0.09)
x += 0.6 * np.sin(2 * np.pi * 95 * tt) * np.exp(-tt / 0.06)
x += 0.5 * blips(0.45, 14, (900, 3000), (0.008, 0.02), 5) * np.exp(-tt / 0.15)
save("crack", fade(x, 0.0005, 0.05), -15)

# bite / scrape on the rock
tt = t(0.22)
x = band(noise(0.22), 900, 5000) * (np.exp(-tt / 0.05) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 70 * tt))))
save("bite", fade(x, 0.002, 0.04), -21)

# clank: stone that does not break (inharmonic ring)
tt = t(0.7)
x = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / dcy) for f, a, dcy in [(523, 1, 0.16), (1187, 0.7, 0.11), (1731, 0.5, 0.08), (2893, 0.35, 0.05), (148, 0.9, 0.07)])
x += 1.2 * band(noise(0.7), 1500, 8000) * np.exp(-tt / 0.012)
save("clank", fade(x, 0.0005, 0.1), -14)

# grinding: stone being milled (rough low noise, 11 Hz chatter)
d = 2.6; tt = t(d)
x = band(noise(d), 90, 1400) * (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 5.5 * tt)) ** 0.5)
x += 0.5 * blips(d, 90, (500, 2200), (0.006, 0.02), 9)
save("grind", fade(x, 0.08, 0.35), -19)

# tick (85% counter)
tt = t(0.035)
save("tick", fade(np.sin(2 * np.pi * 2100 * tt) * np.exp(-tt / 0.006), 0.0005, 0.005), -22)

# bubbles (sand cloud, zzz)
save("bubbles", fade(blips(1.6, 34, (250, 800), (0.03, 0.1), 11) + 0.25 * band(noise(1.6), 100, 600), 0.02, 0.4), -22)

# splash through the surface + surf
tt = t(1.3)
x = band(noise(1.3), 300, 6000) * (np.exp(-tt / 0.25) * np.minimum(1, tt / 0.03)) + 0.4 * blips(1.3, 30, (300, 1200), seed=13)
save("splash", fade(x, 0.002, 0.3), -19)
d = 4.2; tt = t(d)
x = band(noise(d), 200, 3500) * (0.35 + 0.65 * np.sin(np.pi * ((tt * 0.55) % 1)) ** 2)
save("waves", fade(x, 0.25, 0.6), -27)

# night tension: low beating drone that swells
d = 5.4; tt = t(d)
x = (np.sin(2 * np.pi * 49 * tt) + np.sin(2 * np.pi * 52.2 * tt) + 0.5 * np.sin(2 * np.pi * 98.6 * tt) + 0.25 * np.sin(2 * np.pi * 147.5 * tt + np.sin(2 * np.pi * 0.7 * tt)))
x = x * np.minimum(1, tt / 0.6) * np.exp(-np.maximum(0, tt - 2.2) / 1.6) + 0.3 * band(noise(d), 30, 120) * np.exp(-tt / 2.5)
save("drone", fade(x, 0.02, 0.6), -16)

# muffled swarm: fluttering band noise
d = 2.4; tt = t(d)
x = band(noise(d), 500, 2400) * (0.5 + 0.5 * np.sin(2 * np.pi * 27 * tt + 3 * np.sin(2 * np.pi * 3.1 * tt))) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.3 * tt))
x += 0.35 * blips(d, 120, (1500, 3500), (0.004, 0.012), 17)
save("swarm", fade(band(x, 300, 2200), 0.25, 0.5), -24)

# tiny drop
tt = t(0.14)
save("drip", fade(np.sin(2 * np.pi * (900 * tt + 2500 * tt * tt)) * np.exp(-tt / 0.03), 0.001, 0.02), -22)

# pop (cards, labels, pin)
tt = t(0.16)
x = np.sin(2 * np.pi * (260 * tt + 1500 * tt * tt)) * np.exp(-tt / 0.035) + 0.3 * band(noise(0.16), 1500, 6000) * np.exp(-tt / 0.008)
save("pop", fade(x, 0.0005, 0.03), -17)
