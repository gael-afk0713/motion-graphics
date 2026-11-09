// Curiosário — standard channel ending (reusable).
// The logo is rebuilt from public/brand/logo-pixel-80-transparente.png:
// one square per non-transparent pixel of the 80x80 image.
// Pixel art rules: squares are never rotated, and once in place every square
// is snapped to whole screen pixels so neighbours tile with no gaps.
import { Audio } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Silkscreen";
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Easing,
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
const ASSEMBLED = 18; // 0.6 s: every pixel is in place
const PULSE = ASSEMBLED; // 1 -> 1.05 -> 1
const SHRINK = 36; // 1.2 s: logo shrinks and moves up (+ "pop")
const TITLE_START = 40; // CURIOSÁRIO, letter by letter
const TITLE_STEP = 2;
const TAG_IN = 58; // CURTA • SIGA • COMPARTILHE appears (white)
const END_PULSE = 10; // light pulse of the whole composition over the last frames

// Spoken word starts (seconds in outro.mp3), from ffmpeg silencedetect
// (-30 dB, d=0.04): speech stretches 2.252-2.655 | 2.746-3.205 | 3.267-4.007
const TAG_WORDS: { t: string; at: number }[] = [
  { t: "CURTA", at: 2.252 },
  { t: "SIGA", at: 2.746 },
  { t: "COMPARTILHE", at: 3.267 },
];

// ---------------------------------------------------------------------------
// Layout (1080x1920). The final group logo + name + CTA is centred vertically:
// logo 498-1162, accent top 1232, name caps 1271-1336, CTA caps 1386-1423.
// ---------------------------------------------------------------------------
const W_ = 1080;
const H_ = 1920;
const BIG = { width: 0.7 * W_, cy: H_ / 2 }; // art 756 px wide while assembling
const SMALL = { width: 0.55 * W_, cy: 830 }; // art 594 px wide, final
const START_RING = 350; // px: at most this far from the centre at the start

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
// Logo pixels (read from the 80x80 PNG at render time)
// ---------------------------------------------------------------------------
type Kind = "root" | "trunk" | "galaxy";
type Px = { x: number; y: number; rgb: [number, number, number]; kind: Kind };
type Logo = { px: Px[]; x0: number; x1: number; y0: number; y1: number };

const kindOf = (r: number, g: number, b: number): Kind => {
  if (g > 200 && g > r + 40) return "root"; // aqua greens
  const browns = [
    [178, 91, 46],
    [134, 61, 35],
    [80, 34, 24],
  ];
  if (browns.some(([R, G, B]) => R === r && G === g && B === b)) return "trunk";
  return "galaxy";
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
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const px: Px[] = [];
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          if (d[i + 3] < 128) continue;
          const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
          px.push({ x, y, rgb: [r, g, b], kind: kindOf(r, g, b) });
        }
      resolve({
        px,
        x0: Math.min(...px.map((p) => p.x)),
        x1: Math.max(...px.map((p) => p.x)) + 1,
        y0: Math.min(...px.map((p) => p.y)),
        y1: Math.max(...px.map((p) => p.y)) + 1,
      });
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
// Background: night blue with slowly twinkling square stars
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
      {STARS.map((s, i) => {
        const tw = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / s.period + s.phase);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.s,
              height: s.s,
              backgroundColor: s.warm ? "#F9E6A4" : "#FFFFFF",
              opacity: 0.15 + 0.75 * tw * tw,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Pixel logo
// ---------------------------------------------------------------------------
const CORE = { x: 38.5, y: 27.5 }; // galaxy core, in image pixels
const SPARKLE = [249, 230, 164]; // cream sparkles (outside the core they twinkle)

const tint = ([r, g, b]: [number, number, number], a: number) => {
  // a > 0 lightens towards white, a < 0 darkens
  const m = (c: number) => Math.round(a >= 0 ? c + (255 - c) * a : c * (1 + a));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};

const PixelLogo: React.FC<{ logo: Logo; zoom: number }> = ({ logo, zoom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - ASSEMBLED) / fps;
  const artW = logo.x1 - logo.x0;
  const artH = logo.y1 - logo.y0;

  // big -> 55% width, moving up to its place in the centred group
  const shrink = spring({
    frame: frame - SHRINK,
    fps,
    config: { damping: 200 },
    durationInFrames: 24,
  });
  const pulseK = (frame - PULSE) / 8;
  const pulse = pulseK > 0 && pulseK < 1 ? 0.05 * Math.sin(Math.PI * pulseK) : 0;
  const width = interpolate(shrink, [0, 1], [BIG.width, SMALL.width]);
  const cell = (width / artW) * (1 + pulse) * zoom;
  const cx = W_ / 2;
  const cy = H_ / 2 + (interpolate(shrink, [0, 1], [BIG.cy, SMALL.cy]) - H_ / 2) * zoom;
  const ox = cx - (artW * cell) / 2;
  const oy = cy - (artH * cell) / 2;
  const rMax = Math.hypot(artW, artH) * 0.5 * cell;

  // aqua roots glow once the logo is assembled
  const glowIn = interpolate(frame, [ASSEMBLED - 2, ASSEMBLED + 4], [0, 1], clamp);
  const glowBeat = 0.65 + 0.35 * Math.sin((frame - ASSEMBLED) / 6);
  const glow = glowIn * (ASSEMBLED + 4 > frame ? 1 : glowBeat) * cell;
  const shimmerIn = interpolate(frame, [ASSEMBLED, ASSEMBLED + 8], [0, 1], clamp);

  const groups: Record<Kind, React.ReactNode[]> = { root: [], trunk: [], galaxy: [] };
  logo.px.forEach((p, i) => {
    // target square, snapped to whole screen pixels (edges shared with neighbours)
    const L = Math.round(ox + (p.x - logo.x0) * cell);
    const R = Math.round(ox + (p.x - logo.x0 + 1) * cell);
    const T = Math.round(oy + (p.y - logo.y0) * cell);
    const B = Math.round(oy + (p.y - logo.y0 + 1) * cell);
    let left = L;
    let top = T;

    // spiral fly-in, staggered from bottom (roots) to top (galaxy):
    // start = the tree squeezed into a 350 px disc and twisted (silhouette readable)
    const rowK = (logo.y1 - 1 - p.y) / (artH - 1); // 0 bottom .. 1 top
    const delay = rowK * 8 + random(`d${i}`) * 2;
    const k = interpolate(frame + 4 - delay, [0, 12], [0, 1], clamp);
    const e = Easing.out(Easing.cubic)(k);
    if (e < 1) {
      const dx = (L + R) / 2 - cx;
      const dy = (T + B) / 2 - cy;
      const rt = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      const rs = START_RING * Math.tanh(rt / START_RING);
      const twist = 0.8 * (0.3 + 0.7 * (rt / rMax));
      const r = rs + (rt - rs) * e;
      const a = th + twist * (1 - e);
      left = Math.round(cx + r * Math.cos(a) - (R - L) / 2);
      top = Math.round(cy + r * Math.sin(a) - (B - T) / 2);
    }

    let color = `rgb(${p.rgb.join(",")})`;
    let opacity = 1;
    if (p.kind === "galaxy" && shimmerIn > 0) {
      const dist = Math.hypot(p.x + 0.5 - CORE.x, p.y + 0.5 - CORE.y);
      const isSparkle =
        p.rgb[0] === SPARKLE[0] && p.rgb[1] === SPARKLE[1] && p.rgb[2] === SPARKLE[2];
      if (isSparkle && dist > 8) {
        // sparkles around the galaxy blink on/off
        const per = 0.7 + random(`tp${i}`) * 0.9;
        const on = Math.sin((2 * Math.PI * t) / per + random(`tf${i}`) * 6.28) > -0.35;
        opacity = on ? 1 : 1 - 0.8 * shimmerIn;
      } else {
        // brightness wave travelling from the core outwards (stepped, pixel-like)
        const w = Math.sin(2 * Math.PI * 1.1 * t - dist / 3.2);
        const a = Math.round(w * 4) / 4; // 9 brightness steps
        color = tint(p.rgb, (a > 0 ? 0.32 * a : 0.06 * a) * shimmerIn);
      }
    }
    groups[p.kind].push(
      <div
        key={i}
        style={{
          position: "absolute",
          left,
          top,
          width: R - L,
          height: B - T,
          backgroundColor: color,
          opacity,
        }}
      />,
    );
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          filter:
            glow > 0
              ? `drop-shadow(0 0 ${glow * 0.8}px ${ROOT_GLOW}) drop-shadow(0 0 ${glow * 2}px ${ROOT_GLOW}aa) brightness(${1 + 0.2 * glowIn})`
              : undefined,
        }}
      >
        {groups.root}
      </AbsoluteFill>
      <AbsoluteFill>{groups.trunk}</AbsoluteFill>
      <AbsoluteFill>{groups.galaxy}</AbsoluteFill>
    </AbsoluteFill>
  );
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
  const frame = useCurrentFrame();
  const logo = useLogo();
  // closing pulse: 1 -> 1.04 -> 1, finishing on the last frame
  const ek = (frame - (OUTRO_DURATION - 1 - END_PULSE)) / END_PULSE;
  const zoom = ek > 0 && ek <= 1 ? 1 + 0.04 * Math.sin(Math.PI * ek) : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <AbsoluteFill style={{ scale: zoom }}>
        <Stars />
      </AbsoluteFill>
      {/* the logo applies the zoom itself, so its squares stay snapped to the pixel grid */}
      {logo ? <PixelLogo logo={logo} zoom={zoom} /> : null}
      <AbsoluteFill style={{ scale: zoom }}>
        <Title />
        <Tagline />
      </AbsoluteFill>
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
