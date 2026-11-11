// Exports a video's sound-effect placements as an earshot cue file (the moment of each
// action / cut in the picture), for scripts/sfx_sync_check.py.
// usage: node scripts/sfx_cues.mjs src/papagaio/sfx.ts out/papagaio-cues.json
// The module must export FPS and FX: [{ f, file, lead? }] (f = the frame of the action),
// and SFX_DIR (the folder under public/ the files are in).
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [entry, out] = process.argv.slice(2);
if (!entry || !out) throw new Error("usage: node scripts/sfx_cues.mjs <sfx module.ts> <cues.json>");
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sfxcues-")), "sfx.mjs");
await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: tmp, logLevel: "error" });
const { FX, FPS, SFX_DIR = "" } = await import(pathToFileURL(tmp).href);
const fileOf = (f) => path.posix.join(SFX_DIR, /\.\w+$/.test(f) ? f : f + ".wav");

// effects with a sharp moment that must land on the action; beds and slow ramps are not checked
// (kit effects carry their earshot role: whoosh.short, whoosh.long, pop, hit, crack, clank, drip, tick)
const HIT = new Set(["whoosh", "whoosh.short", "whoosh.long", "crack", "bite", "clank", "tick", "pop", "drip", "splash", "impact", "hit", "click", "knock", "shutter"]);
const skipped = {};
const hits = [];
for (const x of FX) {
  const kind = x.role ?? x.file.split("/").pop().replace(/\.wav$/, "");
  if (!HIT.has(kind)) {
    skipped[kind] = (skipped[kind] ?? 0) + 1;
    continue;
  }
  // kit effects also carry their sync point as rendered (align + the lead in frames it was placed with)
  hits.push({ f: x.f, kind, file: fileOf(x.file), lead: x.lead ?? 0, align: x.align ?? (kind.startsWith("whoosh") ? "peak" : "onset") });
}
hits.sort((a, b) => a.f - b.f);
// several effects on the same frame (e.g. crack + whoosh on the bite) are one cue
const events = [];
for (const h of hits) {
  const last = events[events.length - 1];
  if (last && h.f === last.f) {
    if (!last.id.split("+").includes(h.kind)) last.id += "+" + h.kind;
    last.files.push({ file: h.file, start_f: h.f - h.lead, align: h.align });
    continue;
  }
  events.push({ f: h.f, t: +(h.f / FPS).toFixed(4), kind: h.kind, id: h.kind, files: [{ file: h.file, start_f: h.f - h.lead, align: h.align }] });
}
// every placement (beds included), so the checker can separate overlapping effects
const placements = FX.map((x) => ({ file: fileOf(x.file), start_f: x.f - (x.lead ?? 0) }));
fs.writeFileSync(out, JSON.stringify({ fps: FPS, events, placements, skipped_beds: skipped }, null, 1));
console.log(`${events.length} cues -> ${out} (beds / ramps not checked: ${JSON.stringify(skipped)})`);
