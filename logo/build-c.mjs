// CURIOSÁRIO — single "C" symbol made of 3 themed segments.
// Usage: node build-c.mjs  -> out-c/*.png
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");

const OUT = path.resolve("out-c");
fs.mkdirSync(OUT, { recursive: true });

const C = {
  bg: "#0E1733",
  orange: "#FF7A1A",
  orangeDark: "#D95E08",
  gold: "#FFC93C",
  green: "#4CC46A",
  greenLine: "#2C8F47",
  teal: "#2EC4B6",
  tealLine: "#C8FFF8",
  white: "#FFFFFF",
};

// ---- geometry (symbol space, centre of the C ring at 0,0) ------------------
const R = 600; // outer radius
const T = 270; // thickness (uniform)
const r = R - T; // inner radius
const M = (R + r) / 2; // mid radius
const TOP_END = -40; // deg (SVG: 0 = right, clockwise positive)
const BOT_END = 40;
const SEAM_1 = -140; // top | middle
const SEAM_2 = 140; // middle | bottom
const ROUND = 40; // corner rounding at the C ends
const LINE = 22; // uniform detail stroke

const rad = (d) => (d * Math.PI) / 180;
const P = (rr, d) => [rr * Math.cos(rad(d)), rr * Math.sin(rad(d))];
const f = (n) => n.toFixed(2);
const pt = (p) => `${f(p[0])} ${f(p[1])}`;

// The C silhouette: from TOP_END going counter-clockwise (decreasing angle) to BOT_END-360,
// with rounded corners at both ends.
function cPath() {
  const a0 = TOP_END, a1 = BOT_END - 360; // a1 < a0
  const dO = (ROUND / R) * (180 / Math.PI), dI = (ROUND / r) * (180 / Math.PI);
  // outer arc from a0 to a1 (counter-clockwise => sweep-flag 0), large arc
  const s = [];
  s.push(`M ${pt(P(R - ROUND, a0))}`);
  s.push(`Q ${pt(P(R, a0))} ${pt(P(R, a0 - dO))}`);
  s.push(`A ${R} ${R} 0 1 0 ${pt(P(R, a1 + dO))}`);
  s.push(`Q ${pt(P(R, a1))} ${pt(P(R - ROUND, a1))}`);
  s.push(`L ${pt(P(r + ROUND, a1))}`);
  s.push(`Q ${pt(P(r, a1))} ${pt(P(r, a1 + dI))}`);
  s.push(`A ${r} ${r} 0 1 1 ${pt(P(r, a0 - dI))}`);
  s.push(`Q ${pt(P(r, a0))} ${pt(P(r + ROUND, a0))}`);
  s.push("Z");
  return s.join(" ");
}

// Wedge from the centre between two angles (for clipping the segments)
function wedge(d0, d1) {
  const BIG = 2000;
  const steps = 24, pts = [[0, 0]];
  for (let i = 0; i <= steps; i++) pts.push(P(BIG, d0 + ((d1 - d0) * i) / steps));
  return "M " + pts.map(pt).join(" L ") + " Z";
}

// ---- detail layers -----------------------------------------------------------
function leafVeins(detail) {
  // midrib along the whole middle segment (bottom -> top) + side veins pointing up
  const lo = -360 + SEAM_2 + 10, hi = SEAM_1 - 10; // -210 .. -150
  let s = `<path d="M ${pt(P(M, lo))} A ${M} ${M} 0 0 1 ${pt(P(M, hi))}" fill="none" stroke="${C.greenLine}" stroke-width="${LINE}" stroke-linecap="round"/>`;
  if (detail === "full") {
    for (const a of [-202, -186, -170]) {
      const base = P(M, a);
      s += `<path d="M ${pt(base)} L ${pt(P(R - 50, a + 9))} M ${pt(base)} L ${pt(P(r + 50, a + 9))}"
             stroke="${C.greenLine}" stroke-width="${LINE}" stroke-linecap="round" fill="none"/>`;
    }
  }
  return s;
}

function circuit(detail) {
  // traces run along the bottom segment, then leave the lower tip and end in dots
  const lanes = detail === "full" ? [r + 60, M, R - 60] : [M];
  const startA = 118;
  const ext = detail === "full" ? [95, 165, 95] : [150];
  let s = "";
  lanes.forEach((rr, i) => {
    const a0 = startA - i * 12; // staggered starts
    const p0 = P(rr, a0), p1 = P(rr, BOT_END);
    // tangent direction leaving the tip (towards decreasing angle)
    const t = [Math.sin(rad(BOT_END)), -Math.cos(rad(BOT_END))];
    const p2 = [p1[0] + t[0] * ext[i], p1[1] + t[1] * ext[i]];
    s += `<path d="M ${pt(p0)} A ${rr} ${rr} 0 0 0 ${pt(p1)} L ${pt(p2)}" fill="none" stroke="${C.tealLine}" stroke-width="${LINE}" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<circle cx="${f(p0[0])}" cy="${f(p0[1])}" r="${LINE * 0.9}" fill="${C.tealLine}"/>`;
    s += `<circle cx="${f(p2[0])}" cy="${f(p2[1])}" r="${LINE * 1.35}" fill="${C.teal}" stroke="${C.tealLine}" stroke-width="${LINE * 0.8}"/>`;
  });
  return s;
}

function planet(detail) {
  const pr = 170;
  const pc = P(M, TOP_END);
  const id = "pl" + detail;
  let s = `<defs><clipPath id="${id}"><circle cx="${f(pc[0])}" cy="${f(pc[1])}" r="${pr}"/></clipPath></defs>`;
  // gap ring in the background colour gives a clean joint with the gold band
  s += `<circle cx="${f(pc[0])}" cy="${f(pc[1])}" r="${pr + LINE}" fill="${C.bg}"/>`;
  s += `<circle cx="${f(pc[0])}" cy="${f(pc[1])}" r="${pr}" fill="${C.orange}"/>`;
  if (detail === "full") {
    s += `<g clip-path="url(#${id})" transform="rotate(-25 ${f(pc[0])} ${f(pc[1])})">
      <rect x="${f(pc[0] - pr)}" y="${f(pc[1] - 62)}" width="${2 * pr}" height="${LINE * 1.6}" fill="${C.orangeDark}"/>
      <rect x="${f(pc[0] - pr)}" y="${f(pc[1] + 30)}" width="${2 * pr}" height="${LINE * 1.2}" fill="${C.orangeDark}"/></g>`;
  }
  return s;
}

function symbol(detail = "full") {
  const cp = cPath();
  return `
  <defs>
    <clipPath id="segTop${detail}"><path d="${wedge(TOP_END + 5, SEAM_1)}"/></clipPath>
    <clipPath id="segMid${detail}"><path d="${wedge(SEAM_1, -360 + SEAM_2)}"/></clipPath>
    <clipPath id="segBot${detail}"><path d="${wedge(-360 + SEAM_2, BOT_END - 365)}"/></clipPath>
    <clipPath id="cshape${detail}"><path d="${cp}"/></clipPath>
  </defs>
  <g clip-path="url(#cshape${detail})">
    <path d="${cp}" fill="${C.gold}" clip-path="url(#segTop${detail})"/>
    <path d="${cp}" fill="${C.green}" clip-path="url(#segMid${detail})"/>
    <path d="${cp}" fill="${C.teal}" clip-path="url(#segBot${detail})"/>
    <g clip-path="url(#segMid${detail})">${leafVeins(detail)}</g>
  </g>
  ${circuit(detail)}
  ${planet(detail)}`;
}

// ---- text --------------------------------------------------------------------
const FONT_B64 = fs.readFileSync(path.resolve("fonts/Anton-Regular.ttf")).toString("base64");
const fontCss = `@font-face{font-family:Anton;src:url(data:font/ttf;base64,${FONT_B64}) format('truetype');}`;
const TEXT = "CURIOSÁRIO";
const INK = { x0: 0, y0: -1101, w: 4633, h: 1109 }; // Anton @1000px, 4% tracking (PIL)

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const doc = (w, h, body) => `<html><head><style>${fontCss} html,body{margin:0;background:transparent}</style></head><body>
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg></body></html>`;
  async function shot(file, w, h, body) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(doc(w, h, body));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, file), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }
  // measure the symbol's ink bbox (in symbol space) to centre it optically
  await page.setContent(doc(10, 10, `<g id="s">${symbol("full")}</g>`));
  const bb = await page.evaluate(() => {
    const b = document.getElementById("s").getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  console.log("symbol bbox", bb);
  fs.writeFileSync(path.join(OUT, "symbol-bbox.json"), JSON.stringify(bb));

  const bg = `<rect width="2000" height="2000" fill="${C.bg}"/>`;
  const place = (cx, cy, size, detail) => {
    const k = size / Math.max(bb.w, bb.h);
    const tx = cx - (bb.x + bb.w / 2) * k, ty = cy - (bb.y + bb.h / 2) * k;
    return `<g transform="translate(${f(tx)} ${f(ty)}) scale(${k.toFixed(5)})">${symbol(detail)}</g>`;
  };
  const DETAIL = process.env.DETAIL || "full";
  // perfil: symbol ~70% of the circle
  await shot("logo-perfil.png", 2000, 2000, bg + place(1000, 1000, 1400, DETAIL));
  // com nome: smaller symbol on top, white Anton text below
  const textSize = 230, k = textSize / 1000;
  const tw = INK.w * k, th = INK.h * k;
  const symSize = 860, symCy = 760, textTop = symCy + symSize / 2 + 130;
  const text = `<text x="${f(1000 - tw / 2 - INK.x0 * k)}" y="${f(textTop - INK.y0 * k)}" font-family="Anton" font-size="${textSize}" letter-spacing="${f(40 * k)}" fill="${C.white}">${TEXT}</text>`;
  await shot("logo-com-nome.png", 2000, 2000, bg + place(1000, symCy, symSize, DETAIL) + text);
  console.log("text box", { top: textTop, bottom: textTop + th, w: tw });
  await browser.close();
}
main();
