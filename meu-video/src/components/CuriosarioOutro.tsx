// Curiosário — standard channel ending (reusable).
// The logo is rebuilt from public/brand/logo-pixel-80-transparente.png:
// one square per non-transparent pixel of the 80x80 image.
//
// MAIN RULE — pixels never deform, on every frame:
// each logo pixel is a perfect axis-aligned square with an INTEGER size in
// screen pixels, at INTEGER positions, drawn with fillRect on a canvas
// (imageSmoothingEnabled = false, image-rendering: pixelated, no CSS
// transforms, filters or opacity on it). Neighbours share edges: no gaps.
import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Silkscreen";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  random,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const { fontFamily: PIXEL_FONT } = loadFont("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
export const OUTRO_FPS = 30;
// ffprobe -show_entries format=duration public/brand/outro.mp3 -> 4.179592 s, + 0.3 s
export const OUTRO_AUDIO_SEC = 4.179592;
export const OUTRO_DURATION = Math.ceil((OUTRO_AUDIO_SEC + 0.3) * OUTRO_FPS); // 135

const f = (sec: number) => Math.round(sec * OUTRO_FPS);
// "growing tree" entrance (frames at 30 fps); each pixel just switches on
const ROOTS = [0, 7.5]; // 0-0.25 s: roots, from the trunk base out to the tips
const TRUNK = [6, 13.5]; // 0.2-0.45 s: trunk and branches, bottom to top
const GALAXY = [12, 24]; // 0.4-0.8 s: galaxy blooms from the yellow core outwards
const LAST = [24, 27]; // 0.8-0.9 s: planet, then the cream sparkles
const COMPLETE = 27; // 0.9 s: tree complete -> 2-frame white flash on the root edges
const SHRINK = 36; // 1.2 s: logo shrinks (integer pixel steps) and moves up (+ "pop")
const TITLE_START = 40; // CURIOSÁRIO, letter by letter
const TITLE_STEP = 2;
const TAG_IN = 58; // CURTA • SIGA • COMPARTILHE appears (white)

// Spoken word starts (seconds in outro.mp3), from ffmpeg silencedetect
// (-30 dB, d=0.04): speech stretches 2.252-2.655 | 2.746-3.205 | 3.267-4.007
const TAG_WORDS: { t: string; at: number }[] = [
  { t: "CURTA", at: 2.252 },
  { t: "SIGA", at: 2.746 },
  { t: "COMPARTILHE", at: 3.267 },
];

// ---------------------------------------------------------------------------
// Layout (1080x1920). The final group logo + name + CTA is centred vertically:
// logo 488-1172, accent top 1232, name caps 1271-1336, CTA caps 1386-1423.
// ---------------------------------------------------------------------------
const W_ = 1080;
const H_ = 1920;
const BIG = { cell: 15, cy: H_ / 2 }; // 51 x 15 = 765 px wide (~70%)
const SMALL = { cell: 12, cy: 830 }; // 51 x 12 = 612 px wide (~55%)

// Silkscreen Bold, measured in the render: 1 font pixel = 0.1229 em, glyph left bearing = 0.1376 em
const FONT_PX = 0.1229;
const BEARING = 0.1376;
const TITLE_SIZE = 109;
const PX = TITLE_SIZE * FONT_PX; // 13.4 px
const CAP_TOP = 0.423 * TITLE_SIZE; // cap top inside a 1.3 line box (measured)
const TITLE_CAP_Y = 1271;
// 48 * 1.25: at +30% (62 px) Silkscreen Bold is wider than the 1080 frame
const TAG_SIZE = 60;
const TAG_CAP_Y = 1386;

const KEY = "#FFD23F";
const BG = "#060C28";
const ROOT_GLOW = "#49EDB4";
const SHADOW = "#2D0947";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------------------
// Logo pixels (read from the 80x80 PNG at render time) + growth order
// ---------------------------------------------------------------------------
type Kind = "root" | "trunk" | "galaxy" | "planet" | "sparkle";
type Px = { x: number; y: number; color: string; kind: Kind; on: number };
type Logo = {
  px: Px[];
  sparkles: number[]; // indices into px, in blink order
  rootEdge: [number, number][]; // empty cells touching a root pixel (flash)
  x0: number;
  y0: number;
  w: number;
  h: number;
};

const CORE = { x: 38.5, y: 28 }; // centre of the yellow galaxy core
const CREAM = "249,230,164";
const BROWNS = ["178,91,46", "134,61,35", "80,34,24"];
const N8 = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy])).filter(([a, b]) => a || b);

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

  // planet (top right, brown rings + cream): component of the brown pixel at y <= 20
  const top = new Set([...raw.keys()].filter((k) => xy(k)[1] <= 20 && xy(k)[0] >= 50));
  const ringSeed = [...top].find((k) => BROWNS.includes(raw.get(k)!))!;
  const planet = new Set(bfs(top, [ringSeed]).keys());

  const kind = new Map<string, Kind>();
  for (const [k, c] of raw) {
    const [x, y] = xy(k);
    const [r, g] = c.split(",").map(Number);
    if (planet.has(k)) kind.set(k, "planet");
    else if (g > 200 && g > r + 40) kind.set(k, "root");
    else if (BROWNS.includes(c)) kind.set(k, "trunk");
    else if (c === CREAM && Math.hypot(x + 0.5 - CORE.x, y + 0.5 - CORE.y) > 8)
      kind.set(k, "sparkle");
    else kind.set(k, "galaxy");
  }
  const of = (t: Kind) => [...kind.keys()].filter((k) => kind.get(k) === t);
  const touches = (k: string, t: Kind) => {
    const [x, y] = xy(k);
    return N8.some(([dx, dy]) => kind.get(`${x + dx},${y + dy}`) === t);
  };

  // each pixel's switch-on frame
  const on = new Map<string, number>();
  const spread = (keys: string[], dist: (k: string) => number, [a, b]: number[]) => {
    const max = Math.max(...keys.map(dist), 1);
    keys.forEach((k) => on.set(k, Math.floor(a + (dist(k) / max) * (b - a - 0.5))));
  };
  const geo = (keys: string[], seeds: string[], fallback: (k: string) => number) => {
    const d = bfs(new Set(keys), seeds);
    const max = Math.max(...d.values(), 0);
    return (k: string) => d.get(k) ?? max + fallback(k);
  };
  const roots = of("root");
  const trunk = of("trunk");
  // roots: grow from the pixels touching the trunk out to the tips
  spread(roots, geo(roots, roots.filter((k) => touches(k, "trunk")), () => 0), ROOTS);
  // trunk: grow from the pixels touching the roots, up into the branches
  spread(
    trunk,
    geo(trunk, trunk.filter((k) => touches(k, "root")), (k) => 60 - xy(k)[1]),
    TRUNK,
  );
  // galaxy: by distance from the yellow core
  spread(
    of("galaxy"),
    (k) => Math.hypot(xy(k)[0] + 0.5 - CORE.x, xy(k)[1] + 0.5 - CORE.y),
    GALAXY,
  );
  of("planet").forEach((k) => on.set(k, LAST[0]));
  // sparkles: one after the other, last
  const sp = of("sparkle").sort((a, b) => random(`o${a}`) - random(`o${b}`));
  sp.forEach((k, i) => on.set(k, Math.floor(LAST[0] + 1 + (i / sp.length) * (LAST[1] - LAST[0] - 1))));

  const keys = [...raw.keys()];
  const px: Px[] = keys.map((k) => ({
    x: xy(k)[0],
    y: xy(k)[1],
    color: `rgb(${raw.get(k)})`,
    kind: kind.get(k)!,
    on: on.get(k)!,
  }));
  const sparkles = sp.map((k) => keys.indexOf(k));

  // flash: empty cells (4-neighbours) around the roots
  const edge = new Set<string>();
  for (const k of roots) {
    const [x, y] = xy(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = `${x + dx},${y + dy}`;
      if (!raw.has(n)) edge.add(n);
    }
  }
  const xs = px.map((p) => p.x);
  const ys = px.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return {
    px,
    sparkles,
    rootEdge: [...edge].map(xy),
    x0,
    y0,
    w: Math.max(...xs) + 1 - x0,
    h: Math.max(...ys) + 1 - y0,
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
// Pixel logo on a canvas
// ---------------------------------------------------------------------------
const useGeometry = (logo: Logo) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - SHRINK, fps, config: { damping: 200 }, durationInFrames: 24 });
  // integer pixel size: 15 -> 14 -> 13 -> 12, integer origin
  const cell = Math.round(interpolate(s, [0, 1], [BIG.cell, SMALL.cell]));
  const cy = interpolate(s, [0, 1], [BIG.cy, SMALL.cy]);
  const ox = Math.round(W_ / 2 - (logo.w * cell) / 2);
  const oy = Math.round(cy - (logo.h * cell) / 2);
  return { cell, ox, oy };
};

const canvasStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: W_,
  height: H_,
  imageRendering: "pixelated",
};

// soft halo BEHIND the roots (the root pixels themselves stay untouched on top)
const RootHalo: React.FC<{ logo: Logo }> = ({ logo }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const { cell, ox, oy } = useGeometry(logo);
  const glowIn = interpolate(frame, [COMPLETE - 2, COMPLETE + 4], [0, 1], clamp);
  const beat = 0.65 + 0.35 * Math.sin((frame - COMPLETE) / 6);
  const glow = glowIn * (COMPLETE + 4 > frame ? 1 : beat);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.clearRect(0, 0, W_, H_);
    if (glow <= 0) return;
    ctx.fillStyle = ROOT_GLOW;
    for (const p of logo.px)
      if (p.kind === "root")
        ctx.fillRect(ox + (p.x - logo.x0) * cell, oy + (p.y - logo.y0) * cell, cell, cell);
  }, [logo, cell, ox, oy, glow]);
  return (
    <canvas
      ref={ref}
      width={W_}
      height={H_}
      style={{ ...canvasStyle, filter: `blur(${cell * 1.2}px)`, opacity: 0.9 * glow }}
    />
  );
};

const PixelLogo: React.FC<{ logo: Logo }> = ({ logo }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const { cell, ox, oy } = useGeometry(logo);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W_, H_);
    // sparkles: after the tree is complete, one at a time switches off briefly
    const blinkStep = 4; // frames per sparkle
    const n = logo.sparkles.length;
    const off =
      frame >= COMPLETE + 6 ? logo.sparkles[Math.floor((frame - COMPLETE - 6) / blinkStep) % n] : -1;
    logo.px.forEach((p, i) => {
      if (frame < p.on || i === off) return;
      ctx.fillStyle = p.color; // 100% the PNG colour
      ctx.fillRect(ox + (p.x - logo.x0) * cell, oy + (p.y - logo.y0) * cell, cell, cell);
    });
    // tree complete: 2-frame white flash on the edges of the roots
    if (frame >= COMPLETE && frame < COMPLETE + 2) {
      ctx.fillStyle = "#FFFFFF";
      for (const [x, y] of logo.rootEdge)
        ctx.fillRect(ox + (x - logo.x0) * cell, oy + (y - logo.y0) * cell, cell, cell);
    }
  }, [logo, frame, cell, ox, oy]);
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
  const dot = (
    <div
      style={{
        width: Math.round(u * 1.5),
        height: Math.round(u * 1.5),
        backgroundColor: "#FFFFFF",
        margin: `0 ${u * 1.1}px`,
        boxShadow: `0 ${u * 0.6}px 0 rgba(0,0,0,0.5)`,
      }}
    />
  );
  return (
    <div
      style={{
        position: "absolute",
        top: TAG_CAP_Y - 0.423 * TAG_SIZE,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: PIXEL_FONT,
        fontWeight: 700,
        fontSize: TAG_SIZE,
        lineHeight: 1.3,
        letterSpacing: -3.5,
        opacity: appear,
        translate: `0 ${(1 - appear) * 16}px`,
      }}
    >
      {TAG_WORDS.map((w, i) => {
        const on = frame >= f(w.at);
        const k = (frame - f(w.at)) / 6;
        const hop = k >= 0 && k <= 1 ? Math.sin(Math.PI * k) : 0;
        return (
          <React.Fragment key={w.t}>
            {i > 0 ? dot : null}
            <span
              style={{
                display: "inline-block",
                color: on ? KEY : "#FFFFFF",
                scale: 1 + 0.15 * hop,
                // hard pixel shadow + a small, tight glow (keeps the letters crisp)
                textShadow: on
                  ? `0 ${u * 0.6}px 0 #5A3A00, 0 0 ${6 + 4 * hop}px rgba(255,210,63,0.45)`
                  : `0 ${u * 0.6}px 0 rgba(0,0,0,0.5)`,
              }}
            >
              {w.t}
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
          {/* SFX well below the voice */}
          <Audio src={staticFile("brand/sfx/blips.wav")} volume={0.12} />
          <SfxAt frame={SHRINK} src="brand/sfx/pop.wav" volume={0.22} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

const SfxAt: React.FC<{ frame: number; src: string; volume: number }> = ({
  frame,
  src,
  volume,
}) => (
  <Sequence from={frame} layout="none">
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);
