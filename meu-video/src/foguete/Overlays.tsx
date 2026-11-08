import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, SAFE_Y } from "../venus/Overlays";
import { BLOCKS, PUNCHES } from "./captions";
import { IMPACT, IMPACT5, S, sceneEnd, sceneOf } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const KEY = "#FFD23F";
// same caption look as "Ovelha": white heavy text, dark 8-direction outline + soft drop shadow
const O = 5;
const outline =
  [
    [O, 0], [-O, 0], [0, O], [0, -O], [O * 0.7, O * 0.7], [-O * 0.7, O * 0.7], [O * 0.7, -O * 0.7], [-O * 0.7, -O * 0.7],
  ]
    .map(([x, y]) => `${x}px ${y}px 0 #0b1c22`)
    .join(", ") + ", 0 10px 26px rgba(0,0,0,0.55)";

// 100% -> 115% -> 100% quick hop when a yellow keyword is spoken
const hop = (frame: number, at: number) => {
  const k = (frame - at) / 8;
  return k < 0 || k > 1 ? 0 : Math.sin(Math.PI * k);
};

const Block: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = BLOCKS[index];
  const next = index + 1 < BLOCKS.length ? BLOCKS[index + 1].start : Infinity;
  if (frame < b.start || frame >= next) return null;
  const out = Number.isFinite(next) ? interpolate(frame, [next - 3, next], [1, 0], clamp) : 1;
  // the whole block appears at once (the first one is already complete on frame 0)
  const enter = b.start === 0 ? 1 : spring({ frame: frame - b.start + 1, fps, config: { damping: 16, stiffness: 260, mass: 0.5 } });
  const lines = [...new Set(b.words.map((w) => w.line))];
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_Y + 30,
        left: b.side,
        right: b.side,
        opacity: out * interpolate(enter, [0, 0.4], [0, 1], clamp),
        scale: interpolate(enter, [0, 1], [0.92, 1]),
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: b.size,
        lineHeight: 1.12,
        letterSpacing: -1,
      }}
    >
      {lines.map((li) => (
        <div key={li} style={{ display: "flex", justifyContent: "center", alignItems: "baseline", columnGap: b.size * (b.side < 80 ? 0.3 : 0.38), whiteSpace: "nowrap" }}>
          {b.words
            .filter((w) => w.line === li)
            .map((w, i) => {
              // karaoke highlight while the word is being spoken
              const end = Math.max(w.endAt, w.spokenAt + 3);
              const on = interpolate(frame, [w.spokenAt - 2, w.spokenAt + 1, end - 1, end + 2], [0, 1, 1, 0], clamp);
              const pop = w.key ? 0.15 * hop(frame, w.spokenAt - 1) : 0;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    color: w.key ? KEY : "#ffffff",
                    transformOrigin: "50% 80%",
                    scale: Math.max(1 + 0.06 * on, 1 + pop),
                    filter: `brightness(${1 + 0.3 * on})`,
                    textShadow: `${outline}, 0 0 ${28 * on}px ${w.key ? "rgba(255,210,63,0.85)" : "rgba(255,255,255,0.8)"}`,
                  }}
                >
                  {w.text}
                </span>
              );
            })}
        </div>
      ))}
    </div>
  );
};

export const Captions: React.FC = () => (
  <AbsoluteFill>
    {BLOCKS.map((_, i) => (
      <Block key={i} index={i} />
    ))}
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Camera-layer effects: punch-ins, whip pans, flashes, grading, old film
// ---------------------------------------------------------------------------
// transitions: whip pan (alternating direction) except 3->4 and 4->5 (flash)
export const BOUNDARIES = S.slice(1);
const FLASH_AT = [S[3], S[4]];
const WHIP = 4; // frames on each side of the cut

export const punch = (frame: number) =>
  PUNCHES.reduce((a, p) => {
    const d = frame - p + 1;
    if (d < 0 || d > 20) return a;
    const v = d < 3 ? d / 3 : Math.exp(-(d - 3) / 6);
    return Math.max(a, v);
  }, 0);

export const whip = (frame: number) => {
  for (let i = 0; i < BOUNDARIES.length; i++) {
    const B = BOUNDARIES[i];
    if (FLASH_AT.includes(B)) continue;
    const dir = i % 2 === 0 ? -1 : 1;
    if (frame >= B - WHIP && frame < B) {
      const k = (frame - (B - WHIP) + 1) / WHIP;
      return { x: dir * k * k * 0.32, blur: 70 * k };
    }
    if (frame >= B && frame < B + WHIP) {
      const k = 1 - (frame - B) / WHIP;
      return { x: -dir * k * k * 0.32, blur: 70 * k };
    }
  }
  return { x: 0, blur: 0 };
};

const flashAmount = (frame: number) => {
  let a = 0;
  for (const B of FLASH_AT) a = Math.max(a, interpolate(frame, [B - 3, B, B + 6], [0, 1, 0], clamp));
  // impacts
  a = Math.max(a, interpolate(frame, [IMPACT - 1, IMPACT, IMPACT + 1, IMPACT + 7], [0, 1, 0.85, 0], clamp));
  a = Math.max(a, interpolate(frame, [IMPACT5 - 1, IMPACT5, IMPACT5 + 7], [0, 0.75, 0], clamp));
  return a;
};

export const CameraLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const sc = sceneOf(frame);
  const p = punch(frame);
  const w = whip(frame);
  const film = sc === 4;
  // old film: gate weave + flicker
  const weaveX = film ? (random(`wx${frame}`) - 0.5) * 6 : 0;
  const weaveY = film ? (random(`wy${frame}`) - 0.5) * 8 : 0;
  const flick = film ? 0.92 + 0.12 * random(`fl${frame}`) : 1;
  const filters = [
    w.blur > 0 ? "url(#whipBlur)" : "",
    film ? `sepia(0.75) saturate(0.6) contrast(1.25) brightness(${flick})` : "contrast(1.14) saturate(1.12)",
  ].join(" ");
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="whipBlur" x="-20%" y="0%" width="140%" height="100%">
          <feGaussianBlur stdDeviation={`${w.blur} 0`} />
        </filter>
      </svg>
      <AbsoluteFill
        style={{
          filter: filters,
          transform: `translate(${w.x * 100 + weaveX / 10.8}%, ${weaveY}px) scale(${(1 + 0.08 * p) * (w.blur > 0 ? 1.08 : 1)})`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// warm light / cool shadows, vignette, flashes, film grain (scene 5)
export const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  const sc = sceneOf(frame);
  const film = sc === 4;
  const fl = flashAmount(frame);
  const warmFlash = FLASH_AT.some((B) => Math.abs(frame - B) < 6) && frame >= S[4] - 3 && frame < S[4] + 6;
  return (
    <>
      {!film && (
        <AbsoluteFill
          style={{
            mixBlendMode: "soft-light",
            background: "linear-gradient(100deg, rgba(40,90,190,0.55) 0%, rgba(40,90,190,0.15) 45%, rgba(255,150,60,0.35) 80%, rgba(255,140,50,0.5) 100%)",
          }}
        />
      )}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) ${film ? 38 : 52}%, rgba(0,0,0,${film ? 0.85 : 0.55}) 100%)` }} />
      {film && <FilmGrain />}
      {fl > 0 && <AbsoluteFill style={{ backgroundColor: warmFlash ? "#fff1d0" : "#ffffff", opacity: fl }} />}
    </>
  );
};

const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(random(`g${frame}`) * 1000);
  const scratches = [0, 1, 2].filter((i) => random(`s${frame}-${i}`) > 0.55);
  const blotch = random(`b${frame}`) > 0.8;
  return (
    <>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.55 }}>
        <filter id={`grain${frame}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${frame})`} />
      </svg>
      {scratches.map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${random(`sx${frame}-${i}`) * 100}%`,
            width: 2 + random(`sw${frame}-${i}`) * 2,
            background: "rgba(255,245,220,0.35)",
          }}
        />
      ))}
      {blotch && (
        <div
          style={{
            position: "absolute",
            left: `${random(`bx${frame}`) * 90}%`,
            top: `${random(`by${frame}`) * 90}%`,
            width: 30,
            height: 22,
            borderRadius: "50%",
            background: "rgba(30,20,10,0.5)",
          }}
        />
      )}
      <AbsoluteFill style={{ backgroundColor: "rgba(150,110,40,0.2)", mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ backgroundColor: "rgba(70,50,20,0.22)", mixBlendMode: "screen" }} />
    </>
  );
};

export { sceneEnd };
