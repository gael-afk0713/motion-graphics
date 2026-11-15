// Dumps the data exports (no functions) of one or more TS modules as JSON, e.g. a video's sfx list,
// timeline and narration, for the Python level checks.
// usage: node scripts/fx_dump.mjs out.json src/papagaio3/sfx.ts src/papagaio3/timeline.ts src/papagaio3/words.ts
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [out, ...entries] = process.argv.slice(2);
const res = {};
for (const entry of entries) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fxdump-")), "m.mjs");
  await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: tmp, logLevel: "error" });
  const m = await import(pathToFileURL(tmp).href);
  for (const [k, v] of Object.entries(m)) if (typeof v !== "function") res[k] = v;
}
fs.writeFileSync(out, JSON.stringify(res));
console.log("wrote", out, Object.keys(res).join(", "));
