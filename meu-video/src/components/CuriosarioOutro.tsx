// Curiosário — standard channel ending (reusable).
// The logo is rebuilt from public/brand/logo-pixel-80-transparente.png:
// one square per non-transparent pixel of the 80x80 image.
//
// MAIN RULE — pixels never deform, on every frame:
// every logo pixel is a perfect axis-aligned square of the SAME integer size
// (CELL px) at integer positions, drawn with fillRect on a canvas
// (imageSmoothingEnabled = false, image-rendering: pixelated). No CSS / canvas
// transforms, filters or transparency on the logo. Colours come only from the
// PNG palette. The logo never changes scale or position.
// The galaxy grows through pixel-art stages (scripts/galaxy_stages.py) and
// spins ON THE GRID: inverse mapping + nearest neighbour, never an image rotate.
import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Silkscreen";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  GALAXY_BOX,
  GALAXY_CENTROIDS,
  GALAXY_DUST,
  GALAXY_ELLIPSE,
  GALAXY_PALETTE,
  GALAXY_STAGES,
} from "./galaxyStages";

const { fontFamily: PIXEL_FONT } = loadFont("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

// ---------------------------------------------------------------------------
// Timing (frames at 30 fps)
// ---------------------------------------------------------------------------
export const OUTRO_FPS = 30;
// ffprobe -show_entries format=duration public/brand/outro.mp3 -> 4.179592 s, + 0.3 s
export const OUTRO_AUDIO_SEC = 4.179592;
export const OUTRO_DURATION = Math.ceil((OUTRO_AUDIO_SEC + 0.3) * OUTRO_FPS); // 135

const f = (sec: number) => Math.round(sec * OUTRO_FPS);
// Tree: every pixel switches on when the growth front, travelling ALONG the tree
// (BFS from the trunk base), reaches it. Trunk + branches + roots done at 0.5 s.
const GROW_END = 15;
// galaxy: born on the branches (0.3 s), one approved stage every 1-2 frames.
// The 3 smallest stages (11, 14, 17 wide) do not spin; from the 4th stage on,
// the spiral arms turn INSIDE the fixed ellipse: ~0.5 turn, easeOutCubic,
// ending at exactly 0° on the full PNG galaxy at 0.9 s.
//                 11  14  17  20  24  28  33  38  41  44  46  49
const STAGE_AT = [9, 11, 13, 15, 17, 18, 20, 21, 23, 24, 26, 27];
const NO_SPIN_STAGES = 3;
const SPIN_START = STAGE_AT[NO_SPIN_STAGES];
const SPIN_END = STAGE_AT[STAGE_AT.length - 1];
const SPIN_TURNS = 0.5;
// while growing, the galaxy's bottom edge sits 2 pixels above the highest branch
// tip; once it is complete it slides down to the PNG position in whole grid
// rows over the next 5 frames (never in the same frame as a stage change)
const GALAXY_GAP = 2;
const SLIDE = [SPIN_END, SPIN_END + 5]; // moves on frames 28-32
const LAST = 33; // planet, then loose dots and cream sparkles (33-35)
const COMPLETE = 35; // 1.17 s: tree complete -> root tips flash white for 2 frames
const TITLE_START = 18; // 0.6 s: CURIOSÁRIO, letter by letter
const TITLE_STEP = 2;
const TAG_IN = 38; // CTA appears (white) once the name is complete

// Spoken word starts (seconds in outro.mp3), from ffmpeg silencedetect
// (-30 dB, d=0.04): speech stretches 2.252-2.655 | 2.746-3.205 | 3.267-4.007
const TAG_AT: Record<string, number> = { CURTA: 2.252, SIGA: 2.746, COMPARTILHE: 3.267 };
// one line, ~88% of the frame width (950 px)
const TAG_WORDS = ["CURTA", "SIGA", "COMPARTILHE"];

// ---------------------------------------------------------------------------
// Layout (1080x1920): logo + name + CTA centred vertically (493 ... 1427)
// ---------------------------------------------------------------------------
const W_ = 1080;
const H_ = 1920;
const CELL = 12; // px per logo pixel, fixed: 51 x 12 = 612 px wide (~57%)
const LOGO_TOP = 493; // logo 493-1177

// Silkscreen Bold, measured in the render: 1 font pixel = 0.1229 em, glyph left bearing = 0.1376 em
const FONT_PX = 0.1229;
const BEARING = 0.1376;
const CAP_RATIO = 0.423; // cap top inside a 1.3 line box (measured)
const TITLE_SIZE = 109;
const PX = TITLE_SIZE * FONT_PX; // 13.4 px
const CAP_TOP = CAP_RATIO * TITLE_SIZE;
const TITLE_CAP_Y = 1277; // accent top 1237, caps 1277-1344
const TAG_SIZE = 51; // sized so the line is ~950 px wide (~88%)
const TAG_CAP_Y = 1394; // caps 1394-1425

const KEY = "#FFD23F";
const BG = "#060C28";
const ROOT_GLOW = "#49EDB4";
const SHADOW = "#2D0947";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------------------
// Logo pixels (read from the 80x80 PNG at render time) + growth order
// ---------------------------------------------------------------------------
type Kind = "root" | "trunk" | "planet" | "sparkle" | "dust" | "galaxy";
type Px = { x: number; y: number; color: string; kind: Kind; on: number };
type Logo = {
  px: Px[];
  sparkles: number[];
  tips: [number, number][];
  branchTop: number; // y (grid) of the highest branch tip
  x0: number;
  y0: number;
  w: number;
};

const CORE = { x: 38.5, y: 28 }; // centre of the yellow galaxy core
const CREAM = "249,230,164";
const BROWNS = ["178,91,46", "134,61,35", "80,34,24"];
const N8 = [-1, 0, 1]
  .flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy]))
  .filter(([a, b]) => a || b);

// geodesic (8-connected) distance inside a set, from seed cells
const bfs = (cells: Set<string>, seeds: string[]) => {
  const d = new Map<string, number>(seeds.map((s) => [s, 0]));
  const q = [...seeds];
  while (q.length) {
    const c = q.shift()!;
    const [x, y] = c.split(",").map(Number);
    for (const [dx, dy] of N8) {
      const n = `${x + dx},${y + dy}`;
      if (cells.has(n) && !d.has(n)) {
        d.set(n, d.get(c)! + 1);
        q.push(n);
      }
    }
  }
  return d;
};

const buildLogo = (data: Uint8ClampedArray, size: number): Logo => {
  const raw = new Map<string, string>();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (data[i + 3] >= 128) raw.set(`${x},${y}`, `${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
  const xy = (k: string) => k.split(",").map(Number) as [number, number];

  // planet (top right, brown rings + cream): component of a brown pixel at y <= 20
  const top = new Set([...raw.keys()].filter((k) => xy(k)[1] <= 20 && xy(k)[0] >= 50));
  const ringSeed = [...top].find((k) => BROWNS.includes(raw.get(k)!))!;
  const planet = new Set(bfs(top, [ringSeed]).keys());
  const dust = new Set(GALAXY_DUST.map(([x, y]) => `${x},${y}`));

  const kind = new Map<string, Kind>();
  for (const [k, c] of raw) {
    const [x, y] = xy(k);
    const [r, g] = c.split(",").map(Number);
    if (planet.has(k)) kind.set(k, "planet");
    else if (g > 200 && g > r + 30) kind.set(k, "root"); // aqua + light-mint tips
    else if (BROWNS.includes(c)) kind.set(k, "trunk");
    else if (c === CREAM && Math.hypot(x + 0.5 - CORE.x, y + 0.5 - CORE.y) > 8) kind.set(k, "sparkle");
    else if (dust.has(k)) kind.set(k, "dust");
    else kind.set(k, "galaxy"); // drawn from GALAXY_STAGES (last stage = these pixels)
  }
  const of = (t: Kind) => [...kind.keys()].filter((k) => kind.get(k) === t);

  const on = new Map<string, number>();
  const roots = of("root");
  const trunk = of("trunk");
  // single seed: the trunk pixel at the base, centre of the tree
  const base = { x: 39.5, y: 58.5 };
  const seed = trunk.reduce((a, b) =>
    Math.hypot(xy(a)[0] + 0.5 - base.x, xy(a)[1] + 0.5 - base.y) <=
    Math.hypot(xy(b)[0] + 0.5 - base.x, xy(b)[1] + 0.5 - base.y)
      ? a
      : b,
  );
  // one BFS over trunk + branches + roots: the trunk goes up and splits into the
  // branches, the roots spread down from the same base
  const treeD = bfs(new Set([...trunk, ...roots]), [seed]);
  // organic: each branch direction grows at its own speed (±15%, smooth in angle)
  const ph = [0, 1, 2].map((i) => random(`ph${i}`) * Math.PI * 2);
  const speed = (k: string) => {
    const a = Math.atan2(xy(k)[1] + 0.5 - base.y, xy(k)[0] + 0.5 - base.x);
    return 1 + 0.15 * (0.5 * Math.sin(3 * a + ph[0]) + 0.3 * Math.sin(5 * a + ph[1]) + 0.2 * Math.sin(8 * a + ph[2]));
  };
  for (const part of [trunk, roots]) {
    const eff = new Map(part.map((k) => [k, (treeD.get(k) ?? Infinity) / speed(k)]));
    const finite = [...eff.values()].filter(Number.isFinite);
    const max = Math.max(...finite, 1);
    for (const [k, e] of eff) {
      const p = Number.isFinite(e) ? e / max : 1;
      // easeOutQuad front: arrival time t = 1 - sqrt(1 - p) -> the tips arrive last, slower
      on.set(k, Math.min(GROW_END - 1, Math.floor((1 - Math.sqrt(1 - p)) * GROW_END)));
    }
  }
  const rootD = new Map(roots.flatMap((k) => (treeD.has(k) ? [[k, treeD.get(k)!] as const] : [])));
  of("planet").forEach((k) => on.set(k, LAST));
  // loose dots and sparkles: one after the other, last
  const late = [...of("dust"), ...of("sparkle")].sort((a, b) => random(`o${a}`) - random(`o${b}`));
  late.forEach((k, i) => on.set(k, LAST + Math.floor((i / late.length) * 3)));
  of("galaxy").forEach((k) => on.set(k, Infinity));

  // root tips: local maxima of the distance along the roots (1 pixel per tip)
  const tips: [number, number][] = [];
  const taken = new Set<string>();
  for (const k of roots) {
    const d = rootD.get(k) ?? 0;
    const [x, y] = xy(k);
    const nb = N8.map(([dx, dy]) => `${x + dx},${y + dy}`).filter((n) => rootD.has(n));
    if (d > 0 && nb.every((n) => rootD.get(n)! <= d) && !nb.some((n) => taken.has(n))) {
      tips.push([x, y]);
      taken.add(k);
    }
  }

  const keys = [...raw.keys()];
  const px: Px[] = keys.map((k) => ({
    x: xy(k)[0],
    y: xy(k)[1],
    color: `rgb(${raw.get(k)})`,
    kind: kind.get(k)!,
    on: on.get(k)!,
  }));
  const sparkles = keys.flatMap((k, i) => (kind.get(k) === "sparkle" ? [i] : []));
  const xs = px.map((p) => p.x);
  return {
    px,
    sparkles: sparkles.sort((a, b) => random(`b${a}`) - random(`b${b}`)),
    tips,
    x0: Math.min(...xs),
    y0: Math.min(...px.map((p) => p.y)),
    w: Math.max(...xs) + 1 - Math.min(...xs),
    branchTop: Math.min(...trunk.map((k) => xy(k)[1])),
  };
};

let logoPromise: Promise<Logo> | null = null;
const readLogo = () => {
  logoPromise ??= new Promise<Logo>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(buildLogo(ctx.getImageData(0, 0, c.width, c.height).data, c.width));
    };
    img.onerror = () => reject(new Error("could not load logo-pixel-80"));
    img.src = staticFile("brand/logo-pixel-80-transparente.png");
  });
  return logoPromise;
};

const useLogo = () => {
  const [logo, setLogo] = useState<Logo | null>(null);
  const [handle] = useState(() => delayRender("Reading logo pixels"));
  useEffect(() => {
    readLogo()
      .then((l) => {
        setLogo(l);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
  return logo;
};

// ---------------------------------------------------------------------------
// Galaxy: stage + rotation on the grid (inverse mapping, nearest neighbour)
// ---------------------------------------------------------------------------
// every stage is placed (before rotation) centred on the PNG galaxy box; the
// last stage at 0° is therefore exactly the PNG galaxy
const STAGES = GALAXY_STAGES.map((rows) => {
  const w = rows[0].length;
  const h = rows.length;
  const cx = GALAXY_BOX.x0 + GALAXY_BOX.w / 2;
  const cy = GALAXY_BOX.y0 + GALAXY_BOX.h / 2;
  return { rows, w, h, ox: Math.round(cx - w / 2), oy: Math.round(cy - h / 2) };
});

// cells [x, y, colour] of the galaxy at this frame, in logo-grid coordinates
// Ellipse-preserving spin: for each destination cell, undo the ellipse's tilt and
// flattening (-> circle), rotate back by the current angle, re-apply flattening
// and tilt, then take the nearest stage cell. The oval outline never turns; only
// the arms move inside it. Angle 0 = identity (the PNG).
const TILT = GALAXY_ELLIPSE.angle;
const RATIO = GALAXY_ELLIPSE.ratio; // minor / major
const spinSample = (dx: number, dy: number, angle: number): [number, number] => {
  const ct = Math.cos(TILT);
  const st = Math.sin(TILT);
  // into the ellipse frame (major axis along u), then stretch the minor axis -> circle
  const u = dx * ct + dy * st;
  const v = (-dx * st + dy * ct) / RATIO;
  // inverse rotation
  const ca = Math.cos(-angle);
  const sa = Math.sin(-angle);
  const u2 = u * ca - v * sa;
  const v2 = (u * sa + v * ca) * RATIO;
  // back to the grid
  return [u2 * ct - v2 * st, u2 * st + v2 * ct];
};

// cells [x, y, colour] of the galaxy at this frame, in logo-grid coordinates
const galaxyCells = (frame: number, branchTop: number): [number, number, string][] => {
  if (frame < STAGE_AT[0]) return [];
  let si = 0;
  STAGE_AT.forEach((at, i) => {
    if (frame >= at) si = i;
  });
  const s = STAGES[si];
  const k = interpolate(frame, [SPIN_START, SPIN_END], [0, 1], clamp);
  const angle =
    si < NO_SPIN_STAGES ? 0 : -2 * Math.PI * SPIN_TURNS * (1 - Easing.out(Easing.cubic)(k));
  const out: [number, number, string][] = [];
  const [ccx, ccy] = GALAXY_CENTROIDS[si];
  const pcx = s.ox + ccx; // pivot = centroid of the stage
  const pcy = s.oy + ccy;
  const R = Math.ceil(Math.hypot(s.w, s.h)) + 1;
  for (let gy = Math.floor(pcy - R); gy <= pcy + R; gy++)
    for (let gx = Math.floor(pcx - R); gx <= pcx + R; gx++) {
      let sx = gx - s.ox;
      let sy = gy - s.oy;
      if (angle !== 0) {
        const [rx, ry] = spinSample(gx + 0.5 - pcx, gy + 0.5 - pcy, angle);
        sx = Math.floor(rx + ccx);
        sy = Math.floor(ry + ccy);
      }
      if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
      const ch = s.rows[sy][sx];
      if (ch !== ".") out.push([gx, gy, GALAXY_PALETTE[ch.charCodeAt(0) - 97]]);
    }
  if (!out.length) return out;
  // anchor: bottom edge of the squares actually drawn = branch tip - GALAXY_GAP
  // (centreY = branchTop - 2 - currentHeight / 2)
  const bottom = Math.max(...out.map((c) => c[1])) + 1;
  const lift = branchTop - GALAXY_GAP - bottom; // integer grid rows (negative = up)
  const slide = interpolate(frame, SLIDE, [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const dy = Math.round(lift * (1 - slide)); // whole rows only; 0 from frame 32 on
  return out.map(([x, y, c]) => [x, y + dy, c]);
};

// ---------------------------------------------------------------------------
// Background: night blue with square stars switching on/off slowly (opacity 1)
// ---------------------------------------------------------------------------
const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: Math.floor(random(`sx${i}`) * 1080),
  y: Math.floor(random(`sy${i}`) * 1920),
  s: [4, 6, 8][Math.floor(random(`ss${i}`) * 3)],
  period: 2.5 + random(`sp${i}`) * 3,
  phase: random(`sph${i}`) * Math.PI * 2,
  warm: random(`sw${i}`) < 0.3,
}));

const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / OUTRO_FPS;
  return (
    <AbsoluteFill>
      {STARS.map((s, i) =>
        Math.sin((2 * Math.PI * t) / s.period + s.phase) > -0.4 ? (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.s,
              height: s.s,
              backgroundColor: s.warm ? "#F9E6A4" : "#FFFFFF",
            }}
          />
        ) : null,
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Pixel logo on a canvas (fixed size and position)
// ---------------------------------------------------------------------------
const canvasStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: W_,
  height: H_,
  imageRendering: "pixelated",
};
const originOf = (logo: Logo) => ({ ox: Math.round(W_ / 2 - (logo.w * CELL) / 2), oy: LOGO_TOP });

// soft halo BEHIND the roots (the root pixels themselves stay untouched on top)
const RootHalo: React.FC<{ logo: Logo }> = ({ logo }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const { ox, oy } = originOf(logo);
  const glowIn = interpolate(frame, [COMPLETE - 2, COMPLETE + 4], [0, 1], clamp);
  const beat = 0.65 + 0.35 * Math.sin((frame - COMPLETE) / 6);
  const glow = glowIn * (COMPLETE + 4 > frame ? 1 : beat);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.clearRect(0, 0, W_, H_);
    ctx.fillStyle = ROOT_GLOW;
    for (const p of logo.px)
      if (p.kind === "root")
        ctx.fillRect(ox + (p.x - logo.x0) * CELL, oy + (p.y - logo.y0) * CELL, CELL, CELL);
  }, [logo, ox, oy]);
  return (
    <canvas
      ref={ref}
      width={W_}
      height={H_}
      style={{ ...canvasStyle, filter: `blur(${CELL * 1.2}px)`, opacity: 0.9 * glow }}
    />
  );
};

const PixelLogo: React.FC<{ logo: Logo }> = ({ logo }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const { ox, oy } = originOf(logo);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W_, H_);
    const cell = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(ox + (x - logo.x0) * CELL, oy + (y - logo.y0) * CELL, CELL, CELL);
    };
    // sparkles: once the tree is complete, one at a time switches off for 4 frames
    const n = logo.sparkles.length;
    const off = frame >= COMPLETE + 4 ? logo.sparkles[Math.floor((frame - COMPLETE - 4) / 4) % n] : -1;
    // 1) roots + trunk, 2) galaxy stage on top, 3) planet, dust, sparkles
    logo.px.forEach((p) => {
      if ((p.kind === "root" || p.kind === "trunk") && frame >= p.on) cell(p.x, p.y, p.color);
    });
    for (const [x, y, c] of galaxyCells(frame, logo.branchTop)) cell(x, y, c);
    logo.px.forEach((p, i) => {
      if ((p.kind === "planet" || p.kind === "dust" || p.kind === "sparkle") && frame >= p.on && i !== off)
        cell(p.x, p.y, p.color);
    });
    // tree complete: the root tips (1 pixel each) flash white for 2 frames
    if (frame >= COMPLETE && frame < COMPLETE + 2) for (const [x, y] of logo.tips) cell(x, y, "#FFFFFF");
  }, [logo, frame, ox, oy]);
  return <canvas ref={ref} width={W_} height={H_} style={canvasStyle} />;
};

// ---------------------------------------------------------------------------
// CURIOSÁRIO (letter by letter) + CURTA • SIGA • COMPARTILHE (lights up with the voice)
// ---------------------------------------------------------------------------
const pixelShadow = (u: number) =>
  `0 ${u * 0.6}px 0 ${SHADOW}, ${u * 0.45}px ${u * 0.45}px 0 ${SHADOW}`;

// Pixel acute accent drawn on the font's own pixel grid, 1 pixel above the A:
// lower square over the A's centre column, upper square one step up-right.
const ACUTE: [number, number][] = [
  [2, -2],
  [3, -3],
];

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  // "Á" is drawn as "A" + a pixel accent (the font's own accent sits loose and tilted)
  const letters = [..."CURIOSARIO"];
  const accentOn = 6;
  return (
    <div
      style={{
        position: "absolute",
        top: TITLE_CAP_Y - CAP_TOP,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        fontFamily: PIXEL_FONT,
        fontWeight: 700,
        fontSize: TITLE_SIZE,
        lineHeight: 1.3,
        color: "#FFFFFF",
        textShadow: pixelShadow(PX),
      }}
    >
      {letters.map((ch, i) => {
        const at = TITLE_START + i * TITLE_STEP;
        const k = frame - at;
        // stepped pop: 1.35 -> 1.15 -> 1 (pixel-y, no smooth scaling)
        const scale = k < 0 ? 0 : k < 2 ? 1.35 : k < 4 ? 1.15 : 1;
        return (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              opacity: k < 0 ? 0 : 1,
              scale,
              transformOrigin: "50% 70%",
            }}
          >
            {ch}
            {i === accentOn
              ? ACUTE.map(([c, r]) => (
                  <div
                    key={`${c}${r}`}
                    style={{
                      position: "absolute",
                      left: BEARING * TITLE_SIZE + c * PX,
                      top: Math.round(CAP_TOP) + r * PX,
                      width: PX,
                      height: PX,
                      backgroundColor: "#FFFFFF",
                      boxShadow: pixelShadow(PX),
                    }}
                  />
                ))
              : null}
          </span>
        );
      })}
    </div>
  );
};

const Tagline: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [TAG_IN, TAG_IN + 6], [0, 1], clamp);
  const u = TAG_SIZE * FONT_PX; // font pixel
  const gap = TAG_SIZE * 0.5; // clear space on each side of the "•"
  const dot = (
    <div
      style={{
        width: Math.round(u * 1.5),
        height: Math.round(u * 1.5),
        backgroundColor: "#FFFFFF",
        margin: `0 ${gap}px`,
        boxShadow: `0 ${u * 0.6}px 0 rgba(0,0,0,0.5)`,
      }}
    />
  );
  return (
    <div
      style={{
        position: "absolute",
        top: TAG_CAP_Y - CAP_RATIO * TAG_SIZE,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: PIXEL_FONT,
        fontWeight: 700,
        fontSize: TAG_SIZE,
        lineHeight: 1.3,
        opacity: appear,
        translate: `0 ${(1 - appear) * 16}px`,
      }}
    >
      {TAG_WORDS.map((w, i) => {
        const at = f(TAG_AT[w]);
        const on = frame >= at;
        const k = (frame - at) / 6;
        const hop = k >= 0 && k <= 1 ? Math.sin(Math.PI * k) : 0;
        return (
          <React.Fragment key={w}>
            {i > 0 ? dot : null}
            <span
              style={{
                display: "inline-block",
                color: on ? KEY : "#FFFFFF",
                scale: 1 + 0.12 * hop,
                // hard pixel shadow + a very subtle, tight glow (letters stay crisp)
                textShadow: on
                  ? `0 ${u * 0.6}px 0 #5A3A00, 0 0 ${4 + 3 * hop}px rgba(255,210,63,0.3)`
                  : `0 ${u * 0.6}px 0 rgba(0,0,0,0.5)`,
              }}
            >
              {w}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// The ending
// ---------------------------------------------------------------------------
export const CuriosarioOutro: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const logo = useLogo();
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Stars />
      {logo ? (
        <>
          <RootHalo logo={logo} />
          <PixelLogo logo={logo} />
        </>
      ) : null}
      <Title />
      <Tagline />
      {audio ? (
        <>
          <Audio src={staticFile("brand/outro.mp3")} />
          {/* 8-bit blips during the growth, well below the voice */}
          <Audio src={staticFile("brand/sfx/blips.wav")} volume={0.12} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
