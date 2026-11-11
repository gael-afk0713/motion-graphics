#!/usr/bin/env python3
"""SFX sync check for a rendered video (limit: 40 ms between the action and its sound).

  python3 scripts/sfx_sync_check.py out/video.mp4 out/video-cues.json \
      --stem out/video-sfx-stem.wav --sfx-dir public

Cues come from scripts/sfx_cues.mjs: each cue is the frame of an action / cut and the effect file(s)
placed for it (with the frame each file starts on). The stem is the video's effects rendered on their
own by the same composition code (no voice, no ambience), e.g. `npx remotion render <Id>Sfx stem.wav
--codec=wav`.

1. alignment: the stem is cross-correlated with the final video's audio; the lag must be ~0, so what
   is measured on the stem is what plays in the final file.
2. earshot (listening): `earshot timeline STEM --cues CUES` finds the sound event at each cue and its
   offset (negative = sound early); `earshot timeline VIDEO --cues CUES` is reported for the full mix.
3. exact: every placed file (beds too) is located in the stem and fitted (start + gain); each cue's
   effect is then located again by normalised cross-correlation in the stem minus all the others
   (so an effect under a bed or next to a pop is measured on its own); its reference point (a whoosh's loudest moment, any other effect's attack) is compared with
   the action time. This decides OK / FIX.

For each cue over the limit it prints how many frames to move that effect in the video's sfx list.
Exit code 0 = all within the limit, 2 = something to fix.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

SR = 16000
LIMIT_MS = 40.0


def load(path, sr=SR):
    """mono float32 at sr, via ffmpeg (works for video and audio files)"""
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32)


def ref_point(y, align):
    """seconds into the file of the moment that must meet the action: the loudest 5 ms for `peak` (a
    whoosh), else the attack: the first point of the 1 ms envelope within 30 dB of its maximum (the same
    definitions earshot's kit lock uses for peak_s / onset_s)"""
    if align == "peak":
        w = int(0.005 * SR)
        env = np.convolve(y * y, np.ones(w) / w, mode="same")
        return float(np.argmax(env)) / SR
    w = max(1, int(0.001 * SR))
    env = np.sqrt(np.convolve(y * y, np.ones(w) / w, mode="same"))
    return float(np.argmax(env >= env.max() * 10 ** (-30 / 20))) / SR


def locate(mix, y, start_s, search_s):
    """best start of y in mix within start_s +- search_s (normalised cross-correlation) -> (start, score)"""
    n = len(y)
    a = max(0, int((start_s - search_s) * SR))
    b = min(len(mix) - n, int((start_s + search_s) * SR))
    if b <= a:
        return None, 0.0
    seg = mix[a:b + n]
    corr = np.correlate(seg, y, mode="valid")
    energy = np.sqrt(np.convolve(seg * seg, np.ones(n), mode="valid")) * np.linalg.norm(y) + 1e-12
    ncc = corr / energy
    k = int(np.argmax(ncc))
    return (a + k) / SR, float(ncc[k])


def earshot_timeline(path, cues):
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "tl.json")
        subprocess.run(["earshot", "timeline", path, "--cues", cues, "--json", "--out", out],
                       check=True, capture_output=True)
        return json.load(open(out))


def global_lag_ms(stem, mix):
    """lag of the stem inside the final mix (ms; + = mix late), by FFT cross-correlation"""
    n = min(len(stem), len(mix))
    a, b = stem[:n], mix[:n]
    size = 1 << (2 * n - 1).bit_length()
    c = np.fft.irfft(np.fft.rfft(b, size) * np.conj(np.fft.rfft(a, size)), size)
    c = np.concatenate([c[-(n - 1):], c[:n]])
    k = int(np.argmax(c)) - (n - 1)
    return k / SR * 1000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", help="the final rendered video")
    ap.add_argument("cues")
    ap.add_argument("--stem", required=True, help="the effects-only render of the same composition")
    ap.add_argument("--sfx-dir", required=True, help="folder the cue files are relative to (public/)")
    ap.add_argument("--limit-ms", type=float, default=LIMIT_MS)
    ap.add_argument("--json", help="write the full result here")
    args = ap.parse_args()

    cues = json.load(open(args.cues))
    fps = cues["fps"]
    events = cues["events"]

    stem = load(args.stem)
    mix = load(args.video)
    lag = global_lag_ms(stem, mix)

    tl_stem = earshot_timeline(args.stem, args.cues)
    tl_mix = earshot_timeline(args.video, args.cues)
    heard = {round(i["t"], 3): i for i in tl_stem["sync"]["cues"]["items"]}
    es, em = tl_stem["sync"]["cues"]["stats"], tl_mix["sync"]["cues"]["stats"]

    cache = {}

    def get(file, align=None):
        path = os.path.join(args.sfx_dir, file)
        if align is None:
            align = "peak" if os.path.basename(file).startswith("whoosh") else "onset"
        if (path, align) not in cache:
            y = load(path)
            cache[(path, align)] = (y, ref_point(y, align))
        return cache[(path, align)]

    # fit every placement (start near where it was placed, least-squares gain) and build the residual
    fits = {}
    total = np.zeros_like(stem)
    for p in cues.get("placements", []):
        y, _ = get(p["file"])
        start, _score = locate(stem, y, p["start_f"] / fps, 0.06)
        if start is None:
            continue
        i = int(round(start * SR))
        seg = stem[i:i + len(y)]
        g = float(np.dot(seg, y[:len(seg)]) / (np.dot(y[:len(seg)], y[:len(seg)]) + 1e-12))
        fits[(p["file"], p["start_f"])] = (i, g)
        total[i:i + len(seg)] += g * y[:len(seg)]
    residual = stem - total

    def own(file, start_f):
        # the stem with every other placed effect removed (this one's fitted copy put back)
        f = fits.get((file, start_f))
        if f is None:
            return stem
        y, _ = get(file)
        i, g = f
        sig = residual.copy()
        n = min(len(y), len(sig) - i)
        sig[i:i + n] += g * y[:n]
        return sig

    rows = []
    for ev in events:
        t = ev["t"]
        same = [e["t"] for e in events if e is not ev and e["kind"] == ev["kind"]]
        gap = min([abs(x - t) for x in same], default=1.0)
        search = max(0.045, min(0.15, gap / 2 - 0.005))
        found = []
        for fx in ev["files"]:
            align = fx.get("align") or ("peak" if os.path.basename(fx["file"]).startswith("whoosh") else "onset")
            y, ref = get(fx["file"], align)
            start, score = locate(own(fx["file"], fx["start_f"]), y, fx["start_f"] / fps, search)
            if start is None:
                continue
            found.append({"file": fx["file"], "score": round(score, 3), "ref": align,
                          "offset_ms": round((start + ref - t) * 1000 + lag, 1)})
        h = heard.get(round(t, 3), {})
        good = [x for x in found if x["score"] >= 0.5]
        worst = max(good, key=lambda x: abs(x["offset_ms"])) if good else None
        row = {"t": t, "frame": ev["f"], "id": ev["id"], "files": found,
               "offset_ms": worst["offset_ms"] if worst else None,
               "score": min(x["score"] for x in good) if good else max([x["score"] for x in found], default=0),
               "earshot_offset_ms": h.get("offset_ms"), "earshot_status": h.get("status"), "earshot_event": h.get("event")}
        if not good:
            row["verdict"] = "NOT FOUND"
        elif abs(worst["offset_ms"]) <= args.limit_ms:
            row["verdict"] = "OK"
        else:
            row["verdict"] = "FIX"
            row["move_frames"] = -int(round(worst["offset_ms"] / (1000 / fps)))
        rows.append(row)

    n = len(rows)
    ok = sum(r["verdict"] == "OK" for r in rows)
    offs = np.array([abs(r["offset_ms"]) for r in rows if r["offset_ms"] is not None])
    eo = np.array([abs(r["earshot_offset_ms"]) for r in rows if r["earshot_offset_ms"] is not None])
    e_ok = sum(1 for r in rows if r["earshot_offset_ms"] is not None and abs(r["earshot_offset_ms"]) <= args.limit_ms)
    print(f"SFX sync check: {os.path.basename(args.video)} - {n} effect cues (limit {args.limit_ms:.0f} ms)")
    print(f"  stem vs final audio: lag {lag:+.1f} ms (the stem's timing is the final file's)")
    print(f"  exact (each effect located in the stem): {ok}/{n} within the limit; "
          f"median |offset| {np.median(offs):.1f} ms, worst {offs.max():.1f} ms")
    print(f"  earshot on the effects stem: {e_ok}/{n} cues answered within {args.limit_ms:.0f} ms; "
          f"median |offset| {np.median(eo):.1f} ms (chance of a random time: "
          f"{es.get('chance_within_1_frame', 0) * 100:.0f}% within a frame)")
    print(f"  earshot on the final mix (voice + ambience): {em.get('hit_within_1_frame', 0) * 100:.0f}% within a frame, "
          f"{em.get('hit_within_100ms', 0) * 100:.0f}% within 100 ms (chance {em.get('chance_within_1_frame', 0) * 100:.0f}%"
          f" / {em.get('chance_within_100ms', 0) * 100:.0f}%)")
    print()
    print(f"  {'time':>7} {'frame':>5}  {'effect':<20} {'exact':>8} {'match':>5}  {'earshot (stem)':<28} verdict")
    for r in rows:
        mm = f"{int(r['t'] // 60)}:{r['t'] % 60:05.2f}"
        off = "-" if r["offset_ms"] is None else f"{r['offset_ms']:+.0f} ms"
        eh = "-" if r["earshot_offset_ms"] is None else f"{r['earshot_offset_ms']:+.0f} ms {r['earshot_event'] or r['earshot_status']}"
        v = r["verdict"] + (f" (move {r['move_frames']:+d} frames)" if r.get("move_frames") else "")
        print(f"  {mm:>7} {r['frame']:>5}  {r['id'][:20]:<20} {off:>8} {r['score']:>5.2f}  {eh[:28]:<28} {v}")
    if args.json:
        json.dump({"lag_ms": lag, "rows": rows, "earshot_stem": es, "earshot_mix": em,
                   "skipped_beds": cues.get("skipped_beds")}, open(args.json, "w"), indent=1)
    sys.exit(0 if ok == n else 2)


if __name__ == "__main__":
    main()
