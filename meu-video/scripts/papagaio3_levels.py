#!/usr/bin/env python3
"""Peixe-papagaio parte 3: sound effects vs voice, with the stems.

  node scripts/fx_dump.mjs out/papagaio3-fx.json src/papagaio3/sfx.ts src/papagaio3/timeline.ts src/papagaio3/words.ts
  npx remotion render Papagaio3Sfx out/papagaio3-sfx-stem.wav --codec=wav
  python scripts/papagaio3_levels.py out/papagaio3-fx.json out/papagaio3-sfx-stem.wav [--json out/papagaio3-levels.json]

Rules of the video (from the review of the preview):
  * no effect above the voice: in every 100 ms window the effects stem RMS stays at or below the voice
    (the voice RMS in that window, or the scene's typical voice RMS where the voice pauses);
  * pops, whooshes and other short UI sounds: peak at least 6 dB below the voice peak of the same scene;
  * action sounds (scrape, current, tension, sand): peak 8 to 10 dB below the voice peak of the scene;
  * the underwater bed far below the voice.
The voice stem is the 8 narration files placed exactly as in the video (Sequence from S[i]); the effects
stem is the Papagaio3Sfx composition rendered by Remotion (the same placements and volumes as the video).
Prints each effect's peak and the margin to its limit, plus the suggested gain; exits 1 on any failure.
"""
import json
import math
import subprocess
import sys

import numpy as np

SR = 48000
WIN = int(0.1 * SR)
# rules of the sound-design review of v5 (peak relative to the voice peak of the scene, dB):
LIMITS = {
    "pop": -11.0, "bubblepop": -11.0, "beep": -11.0, "thud": -11.0, "key": -11.0, "tick": -11.0,  # label / card pops: ~ -12
    "crack": -9.5, "bite": -9.5,  # the "tec" of the bites: ~ -10
    "sweep": -6.0, "whoosh.short": -6.0, "whoosh.long": -6.0,  # transitions: >= 6 dB under the voice
}
ACTION_LIMIT = -8.0  # current, sand, tension, shimmer and the rest
CEILING = -6.0  # nothing above -6 dB relative to the voice

args = sys.argv[1:]
out_json = None
if "--json" in args:
    i = args.index("--json")
    out_json = args[i + 1]
    del args[i : i + 2]
fx_path, stem_path = args
D = json.load(open(fx_path, encoding="utf-8"))
DUCK = None
try:  # the ducking gains used in the video (src/papagaio3/duck.ts)
    txt = open("src/papagaio3/duck.ts", encoding="utf-8").read()
    DUCK = json.loads(txt[txt.index("= [") + 2: txt.rindex("]") + 1])
except Exception:
    pass
FPS, S, SD, DUR = D["FPS"], D["S"], D["SCENE_DURATIONS"], D["DURATION"]


def decode(f):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).reshape(-1, 2)


def db(x):
    return 20 * math.log10(max(x, 1e-9))


n = int(DUR / FPS * SR) + SR
voice = np.zeros((n, 2), np.float32)
for i, nar in enumerate(D["NARRATION"]):
    a = decode("public/" + nar["file"])
    s0 = int(S[i] / FPS * SR)
    voice[s0 : s0 + len(a)] += a[: n - s0]
sfx = decode(stem_path)
sfx = np.pad(sfx, ((0, max(0, n - len(sfx))), (0, 0)))[:n]

nw = n // WIN
def win_stats(x):
    w = x[: nw * WIN].reshape(nw, WIN, 2)
    rms = np.sqrt((w.astype(np.float64) ** 2).mean(axis=(1, 2)))
    peak = np.abs(w).max(axis=(1, 2))
    return rms, peak
v_rms, v_peak = win_stats(voice)
s_rms, s_peak = win_stats(sfx)
scene_of_win = np.array([max(i for i in range(len(S)) if S[i] <= (k * 0.1) * FPS) for k in range(nw)])
scene = []
for i in range(len(S)):
    sel = scene_of_win == i
    act = v_rms[sel][v_rms[sel] > 10 ** (-40 / 20)]
    scene.append({"peak_db": db(v_peak[sel].max()), "rms_db": db(float(np.median(act))) if len(act) else -60.0})

# per effect: its own peak in the mix (source file x volume)
cache = {}
rows = []
bad = 0
for x in D["FX"]:
    f = "public/" + D["SFX_DIR"] + "/" + x["file"]
    if f not in cache:
        cache[f] = decode(f)
    g = DUCK[min(len(DUCK) - 1, x["f"])] if DUCK else 1.0  # ducked at the moment it hits
    a = cache[f] * x["volume"] * g
    pk = db(float(np.abs(a).max()))
    sc = max(i for i in range(len(S)) if S[i] <= x["f"])
    role = x["role"]
    lim_rel = min(LIMITS.get(role, ACTION_LIMIT), CEILING)
    cat = role
    limit = scene[sc]["peak_db"] + lim_rel
    ok = pk <= limit + 0.05
    bad += 0 if ok else 1
    rows.append({"frame": x["f"], "t": round(x["f"] / FPS, 2), "role": role, "scene": sc + 1, "cat": cat, "peak_db": round(pk, 1), "voice_peak_db": round(scene[sc]["peak_db"], 1), "rel_db": round(pk - scene[sc]["peak_db"], 1), "duck_db": round(db(g), 1), "limit_db": round(limit, 1), "margin_db": round(limit - pk, 1), "ok": ok, "suggest_gain_db": round(min(0.0, limit - pk - 0.5), 1)})

# windows: effects never above the voice
wins_bad = []
for k in range(nw):
    sc = scene_of_win[k]
    if s_rms[k] < 10 ** (-60 / 20):
        continue
    ref = v_rms[k] if v_rms[k] > 10 ** (-40 / 20) else 10 ** (scene[sc]["rms_db"] / 20)
    if s_rms[k] > ref:
        wins_bad.append({"t": round(k * 0.1, 1), "scene": int(sc) + 1, "sfx_rms_db": round(db(s_rms[k]), 1), "voice_ref_db": round(db(ref), 1)})

print("== voz por cena (pico / RMS tipico, janelas de 100 ms)")
for i, s in enumerate(scene):
    print(f"  cena {i + 1}: pico {s['peak_db']:6.1f} dBFS   RMS {s['rms_db']:6.1f} dBFS")
print("== cada efeito: tempo, tipo, nivel relativo ao pico da voz da cena (com o ducking), limite")
for r in sorted(rows, key=lambda r: r["t"]):
    print(f"  {r['t']:6.2f}s  cena {r['scene']}  {r['role']:<11} rel. a voz {r['rel_db']:+6.1f} dB  (ducking {r['duck_db']:+.1f})  limite {r['limit_db'] - r['voice_peak_db']:+5.1f}  {'OK' if r['ok'] else 'ALTO (ganho sugerido ' + str(r['suggest_gain_db']) + ' dB)'}")
print(f"== janelas de 100 ms com efeitos acima da voz: {len(wins_bad)}")
for w in wins_bad[:20]:
    print(f"  {w['t']:6.1f}s cena {w['scene']}: efeitos {w['sfx_rms_db']} dB RMS > voz {w['voice_ref_db']} dB")
loud = max(rows, key=lambda r: r["peak_db"])
print(f"efeito mais alto: {loud['role']} em {loud['t']} s, pico {loud['peak_db']} dBFS; voz: pico max {max(s['peak_db'] for s in scene):.1f} dBFS")
print(f"RESULTADO: {len(rows) - bad}/{len(rows)} efeitos dentro do limite; {len(wins_bad)} janelas acima da voz")
# the bed (as played: bed.wav x ducking) against the voice, RMS per scene
try:
    bed = decode("public/papagaio3/sfx/bed.wav")
    bed = np.pad(bed, ((0, max(0, n - len(bed))), (0, 0)))[:n]
    if DUCK:
        gf = np.repeat(np.array(DUCK + [1.0] * (n // (SR // FPS) + 1 - len(DUCK))), SR // FPS)[:n]
        bed = bed * gf[:, None]
    print("== cama (ambiente) x voz, RMS por cena")
    for i in range(len(S)):
        a0, a1 = int(S[i] / FPS * SR), int((S[i] + SD[i]) / FPS * SR)
        r = db(float(np.sqrt((bed[a0:a1].astype(np.float64) ** 2).mean())))
        print(f"  cena {i + 1}: cama {r:6.1f} dBFS RMS = {r - scene[i]['rms_db']:+5.1f} dB em relacao a voz")
except FileNotFoundError:
    pass
if out_json:
    json.dump({"scenes": scene, "effects": rows, "windows_above_voice": wins_bad}, open(out_json, "w", encoding="utf-8"), indent=1)
sys.exit(0 if bad == 0 and not wins_bad else 1)
