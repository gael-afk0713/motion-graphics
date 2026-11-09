// Curiosário — standard channel ending (reusable).
// The logo is rebuilt from public/brand/logo-pixel-80-transparente.png:
// one square per non-transparent pixel of the 80x80 image.
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
import { FONT } from "../venus/Overlays";

const { fontFamily: PIXEL_FONT } = loadFont("normal", {
  weights: ["700"],
  subsets: ["latin"], // latin includes Á (U+00C1)
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
const TAG_IN = 58; // CURTA • SIGA • COMPARTILHE appears dimmed

// Word timings (seconds in outro.mp3), from ffmpeg silencedetect:
//   -30 dB, d=0.04: speech 0.04-1.95 | 2.252-2.655 | 2.746-3.205 | 3.267-4.007
//   -25 dB, d=0.02 (first phrase): dips at 0.64, 0.81, 1.15, 1.39-1.46
// "curta" 2.252, "siga" 2.746, "compartilhe" 3.267 start exactly on their speech stretch.
type W = { t: string; at: number; key?: boolean };
const CAPTION_BLOCKS: { lines: W[][]; until: number }[] = [
  {
    lines: [
      [
        { t: "Se", at: 0.05 },
        { t: "você", at: 0.17 },
        { t: "gosta", at: 0.4 },
      ],
      [
        { t: "de", at: 0.67 },
        { t: "curiosidades", at: 0.78 },
      ],
    ],
    until: 1.45,
  },
  {
    lines: [
      [
        { t: "como", at: 1.45 },
        { t: "essa,", at: 1.7 },
      ],
    ],
    until: 2.252,
  },
  {
    lines: [
      [
        { t: "curta,", at: 2.252, key: true },
        { t: "siga", at: 2.746, key: true },
        { t: "e", at: 3.08 },
      ],
      [{ t: "compartilhe!", at: 3.267, key: true }],
    ],
    until: Infinity,
  },
];
const SPEECH_END = 4.007;
const TAG_WORDS: { t: string; at: number }[] = [
  { t: "CURTA", at: 2.252 },
  { t: "SIGA", at: 2.746 },
  { t: "COMPARTILHE", at: 3.267 },
];

// ---------------------------------------------------------------------------
// Layout (1080x1920)
// ---------------------------------------------------------------------------
const W_ = 1080;
const BIG = { width: 0.7 * W_, cy: 690 }; // art width 756 px
const SMALL = { width: 0.4 * W_, cy: 500 }; // art width 432 px, top third
const TITLE_Y = 790;
const TAG_Y = 935;
// captions: lower third, kept clear of the logo and of the TikTok UI
// (right-hand buttons and bottom description) — same block as Foguete scene 7
const CAP = { top: 1250, left: 60, right: 220, size: 92 };

const KEY = "#FFD23F";
const BG = "#060C28";
const ROOT_GLOW = "#49EDB4";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------------------
// Logo pixels (read from the 80x80 PNG at render time)
// ---------------------------------------------------------------------------
type Kind = "root" | "trunk" | "galaxy";
type Px = { x: number; y: number; color: string; kind: Kind };
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
          px.push({ x, y, color: `rgb(${r},${g},${b})`, kind: kindOf(r, g, b) });
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
    <AbsoluteFill style={{ backgroundColor: BG }}>
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
const PixelLogo: React.FC<{ logo: Logo }> = ({ logo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const artW = logo.x1 - logo.x0;
  const artCx = (logo.x0 + logo.x1) / 2;
  const artCy = (logo.y0 + logo.y1) / 2;

  // big -> small (smooth spring) and up to the top third
  const shrink = spring({
    frame: frame - SHRINK,
    fps,
    config: { damping: 200 },
    durationInFrames: 24,
  });
  const pulseK = (frame - PULSE) / 8;
  const pulse = pulseK > 0 && pulseK < 1 ? 0.05 * Math.sin(Math.PI * pulseK) : 0;
  const width = interpolate(shrink, [0, 1], [BIG.width, SMALL.width]);
  const cell = (width / artW) * (1 + pulse);
  const cx = W_ / 2;
  const cy = interpolate(shrink, [0, 1], [BIG.cy, SMALL.cy]);

  // galaxy turning: differential swirl around the core (outer edge stays put,
  // so the branches still meet the canopy)
  const core = { x: 38.5, y: 27.5 };
  const swirlR = 27;
  const swirl =
    interpolate(frame, [ASSEMBLED, OUTRO_DURATION], [0, 28], {
      ...clamp,
      easing: Easing.inOut(Easing.sin),
    }) *
    (Math.PI / 180);

  // aqua roots glow once the logo is assembled
  const glowIn = interpolate(frame, [ASSEMBLED - 2, ASSEMBLED + 4], [0, 1], clamp);
  const glowBeat = 0.65 + 0.35 * Math.sin((frame - ASSEMBLED) / 6);
  const glow = glowIn * (ASSEMBLED + 4 > frame ? 1 : glowBeat) * cell;

  const groups: Record<Kind, React.ReactNode[]> = { root: [], trunk: [], galaxy: [] };
  logo.px.forEach((p, i) => {
    // fly-in: staggered from bottom (roots) to top (galaxy)
    const rowK = (logo.y1 - 1 - p.y) / (logo.y1 - 1 - logo.y0); // 0 bottom .. 1 top
    const delay = rowK * 8 + random(`d${i}`) * 2;
    const k = interpolate(frame + 3 - delay, [0, 11], [0, 1], clamp);
    const e = Easing.out(Easing.cubic)(k);
    const ang = random(`a${i}`) * Math.PI * 2;
    const rad = 22 + random(`r${i}`) * 38; // in cells
    const offX = Math.cos(ang) * rad * (1 - e);
    const offY = Math.sin(ang) * rad * (1 - e);
    const spin = (random(`s${i}`) - 0.5) * 360 * (1 - e);

    let gx = p.x + 0.5;
    let gy = p.y + 0.5;
    let rot = spin;
    if (p.kind === "galaxy") {
      const dx = gx - core.x;
      const dy = gy - core.y;
      const r = Math.hypot(dx, dy);
      const a = -swirl * Math.max(0, 1 - r / swirlR) ** 1.5;
      gx = core.x + dx * Math.cos(a) - dy * Math.sin(a);
      gy = core.y + dx * Math.sin(a) + dy * Math.cos(a);
      rot += (a * 180) / Math.PI;
    }
    const x = cx + (gx - artCx + offX) * cell;
    const y = cy + (gy - artCy + offY) * cell;
    const size = cell * (0.7 + 0.3 * e) + 0.6; // +0.6 px: no seams between squares
    groups[p.kind].push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          backgroundColor: p.color,
          rotate: `${rot}deg`,
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
const pixelShadow = "0 8px 0 #2D0947, 6px 6px 0 #2D0947, -2px 8px 0 #2D0947";

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const letters = [..."CURIOSÁRIO"];
  return (
    <div
      style={{
        position: "absolute",
        top: TITLE_Y,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        fontFamily: PIXEL_FONT,
        fontWeight: 700,
        fontSize: 104,
        lineHeight: 1.3,
        color: "#FFFFFF",
        textShadow: pixelShadow,
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
              display: "inline-block",
              opacity: k < 0 ? 0 : 1,
              scale,
              transformOrigin: "50% 70%",
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

const Tagline: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [TAG_IN, TAG_IN + 6], [0, 1], clamp);
  const size = 48;
  const dot = (
    <div
      style={{
        width: size * 0.22,
        height: size * 0.22,
        backgroundColor: "rgba(255,255,255,0.55)",
        margin: `0 ${size * 0.45}px`,
        alignSelf: "center",
      }}
    />
  );
  return (
    <div
      style={{
        position: "absolute",
        top: TAG_Y,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: PIXEL_FONT,
        fontWeight: 700,
        fontSize: size,
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
                color: on ? KEY : "rgba(255,255,255,0.45)",
                scale: 1 + 0.18 * hop,
                textShadow: on
                  ? `0 5px 0 #5A3A00, 0 0 ${18 + 14 * hop}px rgba(255,210,63,0.8)`
                  : "0 5px 0 rgba(0,0,0,0.5)",
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
// Karaoke captions — same look as the videos (Montserrat Black, white,
// dark 8-direction outline, yellow keywords, highlight while spoken)
// ---------------------------------------------------------------------------
const O = 5;
const outline =
  [
    [O, 0],
    [-O, 0],
    [0, O],
    [0, -O],
    [O * 0.7, O * 0.7],
    [-O * 0.7, O * 0.7],
    [O * 0.7, -O * 0.7],
    [-O * 0.7, -O * 0.7],
  ]
    .map(([x, y]) => `${x}px ${y}px 0 #0b1c22`)
    .join(", ") + ", 0 10px 26px rgba(0,0,0,0.55)";
const LEAD = 2;

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {CAPTION_BLOCKS.map((b, bi) => {
        const words = b.lines.flat();
        const start = Math.max(0, f(words[0].at) - LEAD);
        const next = Number.isFinite(b.until) ? f(b.until) - LEAD : Infinity;
        if (frame < start || frame >= next) return null;
        const out = Number.isFinite(next)
          ? interpolate(frame, [next - 3, next], [1, 0], clamp)
          : 1;
        const enter =
          start === 0
            ? 1
            : spring({
                frame: frame - start + 1,
                fps,
                config: { damping: 16, stiffness: 260, mass: 0.5 },
              });
        return (
          <div
            key={bi}
            style={{
              position: "absolute",
              top: CAP.top,
              left: CAP.left,
              right: CAP.right,
              opacity: out * interpolate(enter, [0, 0.4], [0, 1], clamp),
              scale: interpolate(enter, [0, 1], [0.92, 1]),
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: CAP.size,
              lineHeight: 1.12,
              letterSpacing: -1,
            }}
          >
            {b.lines.map((line, li) => (
              <div
                key={li}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "baseline",
                  columnGap: CAP.size * 0.38,
                  whiteSpace: "nowrap",
                }}
              >
                {line.map((w) => {
                  const idx = words.indexOf(w);
                  const s = f(w.at);
                  const e =
                    idx + 1 < words.length
                      ? f(words[idx + 1].at)
                      : bi + 1 < CAPTION_BLOCKS.length
                        ? f(CAPTION_BLOCKS[bi + 1].lines[0][0].at)
                        : f(SPEECH_END);
                  const end = Math.max(e, s + 3);
                  const on = interpolate(
                    frame,
                    [s - 2, s + 1, end - 1, end + 2],
                    [0, 1, 1, 0],
                    clamp,
                  );
                  const hk = (frame - (s - 1)) / 8;
                  const pop = w.key && hk >= 0 && hk <= 1 ? 0.15 * Math.sin(Math.PI * hk) : 0;
                  return (
                    <span
                      key={w.t}
                      style={{
                        display: "inline-block",
                        color: w.key ? KEY : "#ffffff",
                        transformOrigin: "50% 80%",
                        scale: Math.max(1 + 0.06 * on, 1 + pop),
                        filter: `brightness(${1 + 0.3 * on})`,
                        textShadow: `${outline}, 0 0 ${28 * on}px ${w.key ? "rgba(255,210,63,0.85)" : "rgba(255,255,255,0.8)"}`,
                      }}
                    >
                      {w.t}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
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
      {logo ? <PixelLogo logo={logo} /> : null}
      <Title />
      <Tagline />
      <Captions />
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
