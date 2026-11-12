#!/usr/bin/env python3
"""Final audio master (same as scripts/papagaio_master.sh, runs on Windows too): two-pass EBU R128 loudnorm
of the complete mix to -14 LUFS integrated, true peak -1 dBTP. The limiter aims at -1.5 dBTP so the AAC
encode (which overshoots a little) still ends below -1 dBTP. The video stream is copied untouched.

  python scripts/papagaio_master.py <in.mp4|mkv|wav> <out.mp4|wav>
"""
import json
import re
import subprocess
import sys

src, dst = sys.argv[1], sys.argv[2]
LN = "loudnorm=I=-14:TP=-1.5:LRA=11"
log = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-vn", "-af", LN + ":print_format=json", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
m = json.loads(log[log.rindex("{"): log.rindex("}") + 1])
af = (f"{LN}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
print(f"measured: I={m['input_i']} LUFS, TP={m['input_tp']} dBTP, LRA={m['input_lra']}")
if dst.endswith(".mp4"):
    cmd = ["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", src, "-c:v", "copy", "-af", af, "-ar", "48000",
           "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", dst]
else:
    cmd = ["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", src, "-af", af, "-ar", "48000", dst]
subprocess.run(cmd, check=True)
log = subprocess.run(["ffmpeg", "-hide_banner", "-i", dst, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
summary = log[log.rfind("Summary:"):]
i = re.search(r"I:\s+(-?[\d.]+) LUFS", summary)
p = re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary)
print(f"master: I={i.group(1) if i else '?'} LUFS, true peak={p.group(1) if p else '?'} dBTP")
