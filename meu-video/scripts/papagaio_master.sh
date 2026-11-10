#!/bin/bash
# Final audio master: two-pass EBU R128 loudnorm of the complete mix to -14 LUFS integrated,
# true peak -1 dBTP (TikTok/Instagram). The limiter aims at -1.5 dBTP so the AAC encode
# (which overshoots a little) still ends below -1 dBTP. The video stream is copied untouched.
# usage: scripts/papagaio_master.sh <in.mp4|wav> <out>
set -euo pipefail
IN="$1"; OUT="$2"
J=$(ffmpeg -hide_banner -i "$IN" -vn -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
AF="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
echo "measured: I=$(g input_i) LUFS, TP=$(g input_tp) dBTP, LRA=$(g input_lra)"
if [[ "$OUT" == *.mp4 ]]; then
  ffmpeg -hide_banner -v error -y -i "$IN" -c:v copy -af "$AF" -ar 48000 -c:a aac -b:a 256k -movflags +faststart "$OUT"
else
  ffmpeg -hide_banner -v error -y -i "$IN" -af "$AF" -ar 48000 "$OUT"
fi
ffmpeg -hide_banner -i "$OUT" -vn -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' '
