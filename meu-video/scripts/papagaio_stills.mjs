// Preview helper: bundle once, render a list of frames of a composition and tile them.
// usage: node scripts/papagaio_stills.mjs <outDir> <scale> <frame> [frame...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [outDir, scale, ...frames] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const bundleDir = path.join(outDir, "..", "bundle");
const serveUrl =
  process.env.REUSE_BUNDLE && fs.existsSync(bundleDir)
    ? bundleDir
    : await bundle({ entryPoint: path.resolve("src/index.ts"), outDir: bundleDir });
// GL=angle on the PC (GPU); swangle in the cloud
const chromiumOptions = { gl: process.env.GL ?? "swangle", ignoreCertificateErrors: true };
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "Papagaio1", chromiumOptions });
for (const f of frames) {
  const t0 = Date.now();
  await renderStill({
    composition,
    serveUrl,
    frame: Number(f),
    output: path.join(outDir, `f${String(f).padStart(4, "0")}.png`),
    scale: Number(scale),
    chromiumOptions,
  });
  console.log("frame", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
