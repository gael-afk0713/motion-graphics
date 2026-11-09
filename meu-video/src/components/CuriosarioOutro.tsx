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
import { GALAXY_BOX, GALAXY_DUST, GALAXY_PALETTE, GALAXY_STAGES } from "./galaxyStages";

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
const ROOTS = [0, 12]; // 0-0.4 s: roots from the trunk base out to the tips
const TRUNK = [0, 12]; // 0-0.4 s: trunk and branches, bottom to top
// galaxy: one pixel-art stage after another (every 2-3 frames), full at 0.73 s
const STAGE_AT = [0, 2, 4, 7, 9, 12, 14, 17, 19, 22];
const SPIN_END = STAGE_AT[STAGE_AT.length - 1]; // ~1 turn, easeOutCubic, ends at 0°
const LAST = 24; // 0.8 s: planet, then loose dots and cream sparkles (24-26)
const COMPLETE = 27; // 0.9 s: tree complete -> root tips flash white for 2 frames
const TITLE_START = 18; // 0.6 s: CURIOSÁRIO, letter by letter
const TITLE_STEP = 2;
const TAG_IN = 38; // CTA appears (white) once the name is complete

// Spoken word starts (seconds in outro.mp3), from ffmpeg silencedetect
// (-30 dB, d=0.04): speech stretches 2.252-2.655 | 2.746-3.205 | 3.267-4.007
const TAG_AT: Record<string, number> = { CURTA: 2.252, SIGA: 2.746, COMPARTILHE: 3.267 };
// CTA at +40% (84 px) does not fit one line in Silkscreen Bold (max ~60 px in
// 1080 px), so it is set on two lines.
const TAG_LINES = [["CURTA", "SIGA"], ["COMPARTILHE"]];

// ---------------------------------------------------------------------------
// Layout (1080x1920): logo + name + CTA centred vertically (438 ... 1483)
// ---------------------------------------------------------------------------
const W_ = 1080;
const H_ = 1920;
const CELL = 12; // px per logo pixel, fixed: 51 x 12 = 612 px wide (~57%)
const LOGO_TOP = 438; // logo 438-1122

// Silkscreen Bold, measured in the render: 1 font pixel = 0.1229 em, glyph left bearing = 0.1376 em
const FONT_PX = 0.1229;
const BEARING = 0.1376;
const CAP_RATIO = 0.423; // cap top inside a 1.3 line box (measured)
const TITLE_SIZE = 109;
const PX = TITLE_SIZE * FONT_PX; // 13.4 px
const CAP_TOP = CAP_RATIO * TITLE_SIZE;
const TITLE_CAP_Y = 1222; // accent top 1182, caps 1222-1289
const TAG_SIZE = 84; // +40%
const TAG_CAP_Y = 1339; // line 1 caps 1339-1391, line 2 caps 1431-1483
const TAG_LINE_GAP = 92;

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
type Logo = { px: Px[]; sparkles: number[]; tips: [number, number][]; x0: number; y0: number; w: number };

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
  const touches = (k: string, t: Kind) => {
    const [x, y] = xy(k);
    return N8.some(([dx, dy]) => kind.get(`${x + dx},${y + dy}`) === t);
  };

  const on = new Map<string, number>();
  const grow = (keys: string[], seeds: string[], [a, b]: number[]) => {
    const d = bfs(new Set(keys), seeds);
    const max = Math.max(...d.values(), 1);
    keys.forEach((k) => on.set(k, Math.floor(a + ((d.get(k) ?? max) / max) * (b - a - 0.5))));
    return d;
  };
  const roots = of("root");
  const trunk = of("trunk");
  // roots grow from the pixels touching the trunk; trunk from the pixels touching the roots
  const rootD = grow(roots, roots.filter((k) => touches(k, "trunk")), ROOTS);
  grow(trunk, trunk.filter((k) => touches(k, "root")), TRUNK);
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
const STAGES = GALAXY_STAGES.map((rows) => {
  const w = rows[0].length;
  const h = rows.length;
  // centred on the galaxy box centre (= top of the trunk), snapped to the grid
  const cx = GALAXY_BOX.x0 + GALAXY_BOX.w / 2;
  const cy = GALAXY_BOX.y0 + GALAXY_BOX.h / 2;
  return { rows, w, h, ox: Math.round(cx - w / 2), oy: Math.round(cy - h / 2) };
});

// cells [x, y, colour] of the galaxy at this frame, in logo-grid coordinates
const galaxyCells = (frame: number): [number, number, string][] => {
  let si = 0;
  STAGE_AT.forEach((at, i) => {
    if (frame >= at) si = i;
  });
  const s = STAGES[si];
  const k = Math.min(1, frame / SPIN_END);
  const angle = -2 * Math.PI * (1 - Easing.out(Easing.cubic)(k)); // 1 turn -> 0
  const out: [number, number, string][] = [];
  const pcx = s.ox + s.w / 2;
  const pcy = s.oy + s.h / 2;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const R = Math.ceil(Math.hypot(s.w, s.h) / 2) + 1;
  for (let gy = Math.floor(pcy - R); gy <= pcy + R; gy++)
    for (let gx = Math.floor(pcx - R); gx <= pcx + R; gx++) {
      // centre of the destination cell, rotated back into the stage
      const dx = gx + 0.5 - pcx;
      const dy = gy + 0.5 - pcy;
      const sx = Math.floor(dx * cos - dy * sin + s.w / 2);
      const sy = Math.floor(dx * sin + dy * cos + s.h / 2);
      if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
      const ch = s.rows[sy][sx];
      if (ch !== ".") out.push([gx, gy, GALAXY_PALETTE[ch.charCodeAt(0) - 97]]);
    }
  return out;
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
    for (const [x, y, c] of galaxyCells(frame)) cell(x, y, c);
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
  const letter = TAG_SIZE * 0.72; // one letter advance: the space kept around each "•"
  const dot = (
    <div
      style={{
        width: Math.round(u * 1.5),
        height: Math.round(u * 1.5),
        backgroundColor: "#FFFFFF",
        margin: `0 ${letter}px`,
        boxShadow: `0 ${u * 0.6}px 0 rgba(0,0,0,0.5)`,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity: appear, translate: `0 ${(1 - appear) * 16}px` }}>
      {TAG_LINES.map((words, li) => (
        <div
          key={li}
          style={{
            position: "absolute",
            top: TAG_CAP_Y + li * TAG_LINE_GAP - CAP_RATIO * TAG_SIZE,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: PIXEL_FONT,
            fontWeight: 700,
            fontSize: TAG_SIZE,
            lineHeight: 1.3,
          }}
        >
          {words.map((w, i) => {
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
      ))}
    </AbsoluteFill>
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
