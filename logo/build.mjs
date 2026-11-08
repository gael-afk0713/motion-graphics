// Builds the CURIOSÁRIO logo assets (icons, Anton text) and local previews.
// Usage: node build.mjs  (needs the preinstalled Playwright/Chromium)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
fs.mkdirSync(OUT, { recursive: true });

// ---- palette -------------------------------------------------------------
const C = {
  bg: "#0E1A3C",
  line: "#0A1022", // uniform outline/detail colour
  orange: "#FF8A3D",
  orangeDark: "#E0612A",
  ring: "#FFD27A",
  moon: "#E6E9F2",
  green: "#4CC76A",
  greenDark: "#2F9E4F",
  teal: "#2EC4B6",
  tealDark: "#178F84",
  tealLight: "#7FF0E2",
  yellow: "#FFC93C",
  ink: "#12141C",
  star: "#FFE9B0",
};
const W = 20; // the same stroke weight for every icon (in the 512 icon box)

// ---- icons (512x512 boxes, same visual size) -------------------------------
const planet = `
<defs>
  <clipPath id="front"><rect x="0" y="256" width="512" height="256" transform="rotate(-18 256 256)"/></clipPath>
  <clipPath id="body"><circle cx="256" cy="268" r="168"/></clipPath>
</defs>
<g transform="rotate(-18 256 268)">
  <ellipse cx="256" cy="268" rx="248" ry="70" fill="none" stroke="${C.line}" stroke-width="${30 + 2 * W}"/>
  <ellipse cx="256" cy="268" rx="248" ry="70" fill="none" stroke="${C.ring}" stroke-width="30"/>
</g>
<circle cx="256" cy="268" r="168" fill="${C.orange}" stroke="${C.line}" stroke-width="${W}"/>
<g clip-path="url(#body)">
  <path d="M70 310 C 180 280, 330 280, 440 250 L 440 316 C 330 346, 180 346, 70 376 Z" fill="${C.orangeDark}"/>
  <path d="M70 196 C 170 180, 300 175, 440 152 L 440 186 C 300 208, 170 213, 70 230 Z" fill="${C.orangeDark}"/>
</g>
<circle cx="256" cy="268" r="168" fill="none" stroke="${C.line}" stroke-width="${W}"/>
<g clip-path="url(#front)">
  <g transform="rotate(-18 256 268)">
    <ellipse cx="256" cy="268" rx="248" ry="70" fill="none" stroke="${C.line}" stroke-width="${30 + 2 * W}"/>
    <ellipse cx="256" cy="268" rx="248" ry="70" fill="none" stroke="${C.ring}" stroke-width="30"/>
  </g>
</g>
<circle cx="452" cy="70" r="40" fill="${C.moon}" stroke="${C.line}" stroke-width="${W}"/>
`;

const leafDna = `
<path d="M178 452 L150 498" stroke="${C.line}" stroke-width="${22 + 2 * W}" stroke-linecap="round"/>
<path d="M178 452 L150 498" stroke="${C.greenDark}" stroke-width="22" stroke-linecap="round"/>
<path d="M178 456 C 40 360, 70 120, 330 46 C 380 250, 330 410, 178 456 Z"
      fill="${C.green}" stroke="${C.line}" stroke-width="${W}" stroke-linejoin="round"/>
<path d="M178 456 C 220 340, 262 210, 322 70" fill="none" stroke="${C.line}" stroke-width="${W}" stroke-linecap="round"/>
<path d="M205 370 L 135 330 M 232 290 L 160 240 M 258 215 L 205 160
         M 214 345 L 290 320 M 242 262 L 318 228 M 268 190 L 330 160"
      fill="none" stroke="${C.line}" stroke-width="${W}" stroke-linecap="round"/>
<g transform="translate(400 0)">
  <g stroke-linecap="round">
    ${[150, 205, 260, 315, 370, 425]
      .map((y) => {
        const p = (y - 120) / 110;
        const half = Math.abs(Math.cos(p * Math.PI)) * 44 + 6;
        return `<path d="M ${-half} ${y} L ${half} ${y}"                 <path d="M ${-half} ${y} L ${half} ${y}" stroke="${C.tealLight}" stroke-width="${W}"/>`;
      })
      .join("")}
    <path d="M -50 120 C 50 175, 50 230, 0 285 S -50 395, 50 450" fill="none" stroke="${C.line}" stroke-width="${30 + 2 * W}"/>
    <path d="M 50 120 C -50 175, -50 230, 0 285 S 50 395, -50 450" fill="none" stroke="${C.line}" stroke-width="${30 + 2 * W}"/>
    <path d="M -50 120 C 50 175, 50 230, 0 285 S -50 395, 50 450" fill="none" stroke="${C.teal}" stroke-width="30"/>
    <path d="M 50 120 C -50 175, -50 230, 0 285 S 50 395, -50 450" fill="none" stroke="${C.teal}" stroke-width="30"/>
  </g>
</g>
`;

const pins = [];
for (const t of [-72, 0, 72]) {
  pins.push([256 + t, 126, 256 + t, 52]); // top
  pins.push([256 + t, 386, 256 + t, 460]); // bottom
  pins.push([126, 256 + t, 52, 256 + t]); // left
  pins.push([386, 256 + t, 460, 256 + t]); // right
}
const chip = `
${pins.map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.line}" stroke-width="${18 + 2 * W}" stroke-linecap="round"/>`).join("")}
${pins.map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.tealLight}" stroke-width="18" stroke-linecap="round"/>`).join("")}
${pins.map(([, , x2, y2]) => `<circle cx="${x2}" cy="${y2}" r="18" fill="${C.tealLight}" stroke="${C.line}" stroke-width="${W}"/>`).join("")}
<rect x="116" y="116" width="280" height="280" rx="34" fill="${C.teal}" stroke="${C.line}" stroke-width="${W}"/>
<rect x="186" y="186" width="140" height="140" rx="18" fill="${C.tealLight}" stroke="${C.line}" stroke-width="${W}"/>
<path d="M216 256 L296 256 M256 216 L256 296" stroke="${C.line}" stroke-width="${W}" stroke-linecap="round" opacity="0.5"/>
`;

// Content is scaled so nothing touches the 512 box (no clipping in the PNGs)
const fit = (k, svg) => `<g transform="translate(256 256) scale(${k}) translate(-256 -256)">${svg}</g>`;
const ICONS = { planeta: fit(0.84, planet), "folha-dna": fit(0.92, leafDna), chip };
// Per-icon display scale so the three have the same visible area
const EQ = { planeta: 1.106, "folha-dna": 1.015, chip: 0.908 };
const icon = (name, x, y, size0) => { const size = size0 * EQ[name]; return `<svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 512 512" overflow="visible">${ICONS[name]}</svg>`; };

// ---- text (Anton, normal proportions, 4% letter-spacing) ------------------
const FONT_B64 = fs.readFileSync(path.resolve("fonts/Anton-Regular.ttf")).toString("base64");
const fontCss = `@font-face{font-family:Anton;src:url(data:font/ttf;base64,${FONT_B64}) format('truetype');}`;
const TEXT = "CURIOSÁRIO";

// Band geometry (com-nome)
export const BAND = { cx: 1000, cy: 1000, len: 1300, h: 320, cut: 80, angle: -8, stroke: 8 };
const MARGIN = 0.12; // min margin above/below the ink, as share of band height

const stars = (pts) =>
  pts.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.star}" opacity="${o}"/>`).join("");
const STARS_NOME = [[380, 560, 7, 0.45], [1620, 520, 8, 0.4], [1300, 230, 5, 0.35], [330, 1330, 6, 0.35], [1680, 1330, 6, 0.4], [1000, 1850, 5, 0.3]];
const STARS_PERFIL = [[330, 560, 7, 0.4], [1670, 560, 7, 0.4], [1000, 1780, 6, 0.3], [470, 1720, 5, 0.3], [1530, 1720, 5, 0.3]];

function bandPath(b) {
  const x0 = b.cx - b.len / 2, y0 = b.cy - b.h / 2;
  return `M${x0 + b.cut} ${y0} L${x0 + b.len} ${y0} L${x0 + b.len - b.cut} ${y0 + b.h} L${x0} ${y0 + b.h} Z`;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  // 1) ink box of "CURIOSÁRIO" in Anton at 1000px with 4% (40px) tracking,
  //    measured from the TTF with PIL (x0/y0 relative to the baseline origin):
  //    the Á accent is included in the height.
  const ink = { x0: 0, y0: -1101, w: 4633, h: 1109 };
  // font size so that ink height fills band height minus 2*MARGIN
  const inkH = BAND.h * (1 - 2 * MARGIN);
  const fs_ = (1000 * inkH) / ink.h;
  const k = fs_ / 1000;
  const text = { size: fs_, w: ink.w * k, h: ink.h * k, x0: ink.x0 * k, y0: ink.y0 * k, ls: 40 * k };
  console.log("ink@1000:", ink, "-> font-size", fs_.toFixed(1), "text", text.w.toFixed(0), "x", text.h.toFixed(0));
  fs.writeFileSync(path.join(OUT, "text-metrics.json"), JSON.stringify({ BAND, text }, null, 2));

  const textSvg = (cx, cy, angle, scale = 1) => `
    <g transform="rotate(${angle} ${cx} ${cy})">
      <text x="${cx - text.w / 2 - text.x0}" y="${cy - text.h / 2 - text.y0}" font-family="Anton" font-size="${text.size}"
            letter-spacing="${text.ls}" fill="${C.ink}">${TEXT}</text>
    </g>`;

  const svgDoc = (w, h, body) =>
    `<html><head><style>${fontCss} html,body{margin:0;background:transparent}</style></head><body>
     <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg></body></html>`;

  async function shot(file, w, h, body, scale = 1) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(svgDoc(w, h, body));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, file), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }

  // 2) individual transparent assets for Canva
  for (const name of Object.keys(ICONS)) await shot(`icone-${name}.png`, 1024, 1024, icon(name, 512, 512, 1024));
  // text alone, unrotated, 2x resolution, tight box (+pad)
  const pad = 6;
  const tw = Math.ceil(text.w * 2 + pad * 2), th = Math.ceil(text.h * 2 + pad * 2);
  await shot("texto-anton.png", tw, th,
    `<text x="${pad - text.x0 * 2}" y="${pad - text.y0 * 2}" font-family="Anton" font-size="${text.size * 2}" letter-spacing="${text.ls * 2}" fill="${C.ink}">${TEXT}</text>`);

  // 3) local previews of both versions (what Canva should reproduce)
  const bg = `<rect width="2000" height="2000" fill="${C.bg}"/>`;
  const P = { s: 720, top: [1000, 570], left: [615, 1355], right: [1385, 1355] };
  const perfil = bg + stars(STARS_PERFIL) + icon("planeta", ...P.top, P.s) + icon("folha-dna", ...P.left, P.s) + icon("chip", ...P.right, P.s);
  const N = { s: 450, top: [1000, 455], left: [650, 1525], right: [1350, 1525] };
  const band = `<g transform="rotate(${BAND.angle} ${BAND.cx} ${BAND.cy})">
      <path d="${bandPath({ ...BAND, cy: BAND.cy + 22 })}" fill="#000" opacity="0.3"/>
      <path d="${bandPath(BAND)}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="${BAND.stroke}" stroke-linejoin="miter"/></g>`;
  const nome = bg + stars(STARS_NOME) + icon("planeta", ...N.top, N.s) + icon("folha-dna", ...N.left, N.s) + icon("chip", ...N.right, N.s) + band + textSvg(BAND.cx, BAND.cy, BAND.angle);
  await shot("preview-perfil.png", 2000, 2000, perfil);
  await shot("preview-com-nome.png", 2000, 2000, nome);
  fs.writeFileSync(path.join(OUT, "layout.json"), JSON.stringify({ P, N, STARS_PERFIL, STARS_NOME, C }, null, 2));
  await browser.close();
}
main();
