// Everything 2D on top of the 3D: karaoke captions, the giant tool labels, the series
// badge, the 85% counter, the MALDIVAS tag, the A/B cards and the camera-layer effects.
// TikTok safe area: nothing important in the top 150 px, bottom 420 px, right 160 px.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../venus/Overlays";
import { CardCanvas } from "./Scene3D";
import {
  at,
  C1_ISLAND,
  C1_RISE,
  C2_BITE,
  C3_CLANK,
  C4_LABEL,
  C5_85,
  C5_COUNT,
  C5_GLOBE,
  C5_LABEL,
  C5_PIN,
  C5_SCHOOL,
  C6_DROP,
  C7_NIGHT,
  C8_A,
  C8_B,
  DURATION,
  FREEZE,
  S,
  sceneEnd,
  WHIPS,
} from "./timeline";
import { NARRATION } from "./words";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const KEY = "#FFD23F";
const INK = "#0b1c22";
const stroke = (px: number): React.CSSProperties => ({
  WebkitTextStroke: `${px}px ${INK}`,
  paintOrder: "stroke fill",
});

// ---------------------------------------------------------------------------
// Captions: 1-3 words at a time, exactly the narration
// ---------------------------------------------------------------------------
type W = { text: string; key: boolean; start: number };
type Chunk = { words: W[]; start: number; end: number };
export const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  NARRATION.forEach((n, si) => {
    let wi = 0;
    n.text.split(" | ").forEach((c) => {
      const words = c.split(" ").map((raw) => ({
        text: raw.replace(/\*/g, ""),
        key: raw.includes("*"),
        start: at(si, n.t[wi++]),
      }));
      out.push({ words, start: Math.max(S[si], words[0].start - 2), end: sceneEnd(si) });
    });
  });
  out.forEach((c, i) => {
    if (i + 1 < out.length) c.end = Math.min(c.end, out[i + 1].start);
  });
  return out;
})();

const CAPTION_TOP = 1262;
const CAPTION_SIZE = 86;
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = CHUNKS.find((x) => frame >= x.start && frame < x.end);
  if (!c) return null;
  const enter = c.start === 0 ? 1 : spring({ frame: frame - c.start + 1, fps, config: { damping: 15, stiffness: 300, mass: 0.45 } });
  return (
    <div
      style={{
        position: "absolute",
        top: CAPTION_TOP,
        left: 150,
        right: 150,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        columnGap: CAPTION_SIZE * 0.3,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: CAPTION_SIZE,
        lineHeight: 1.1,
        letterSpacing: -1,
        scale: interpolate(enter, [0, 1], [0.86, 1]),
        opacity: interpolate(enter, [0, 0.35], [0, 1], clamp),
        transformOrigin: "50% 40%",
      }}
    >
      {c.words.map((w, i) => {
        const end = i + 1 < c.words.length ? c.words[i + 1].start : c.end;
        const e2 = Math.max(end, w.start + 3);
        const on = interpolate(frame, [w.start - 2, w.start + 1, e2 - 1, e2 + 2], [0, 1, 1, 0], clamp);
        const hop = w.key ? 0.14 * Math.max(0, Math.sin((Math.PI * (frame - w.start + 1)) / 8)) * (frame - w.start < 8 ? 1 : 0) : 0;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              color: w.key ? KEY : "#ffffff",
              ...stroke(16),
              scale: 1 + 0.07 * on + hop,
              transformOrigin: "50% 80%",
              filter: `drop-shadow(0 8px 10px rgba(0,0,0,0.5)) brightness(${0.9 + 0.2 * on})`,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Series badge + giant tool labels
// ---------------------------------------------------------------------------
export const Badge: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 60,
      top: 180,
      background: KEY,
      color: "#000",
      fontFamily: FONT,
      fontWeight: 900,
      fontSize: 34,
      letterSpacing: 1,
      padding: "8px 18px 6px",
      borderRadius: 10,
      border: `4px solid ${INK}`,
      boxShadow: "0 6px 0 rgba(0,0,0,0.35)",
    }}
  >
    PARTE 1/3
  </div>
);

const LABELS: { from: number; to: number; lines: string[]; size: number }[] = [
  { from: C2_BITE, to: sceneEnd(1), lines: ["PICARETA"], size: 150 },
  { from: C4_LABEL, to: sceneEnd(3), lines: ["MOEDOR"], size: 176 },
  { from: C5_LABEL, to: sceneEnd(4), lines: ["FÁBRICA", "DE ILHAS"], size: 122 },
];
export const ToolLabels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = LABELS.find((x) => frame >= x.from && frame < x.to);
  if (!l) return null;
  const pop = spring({ frame: frame - l.from, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  return (
    <div
      style={{
        position: "absolute",
        top: l.lines.length > 1 ? 262 : 290,
        left: 40,
        width: 880,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: l.size,
        lineHeight: 0.98,
        letterSpacing: -2,
        color: KEY,
        ...stroke(26),
        scale: interpolate(pop, [0, 1], [0.2, 1]) * (1 + 0.015 * Math.sin(frame * 0.3)),
        rotate: `${interpolate(pop, [0, 1], [-8, -3])}deg`,
        filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.35))",
      }}
    >
      {l.lines.map((t) => (
        <div key={t}>{t}</div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 5: MALDIVAS tag and the 85% counter
// ---------------------------------------------------------------------------
export const COUNT_FRAMES = 34;
export const Scene5Overlays: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame >= C5_PIN && frame < C5_85) {
    const pop = spring({ frame: frame - C5_PIN, fps, config: { damping: 10, stiffness: 260, mass: 0.5 } });
    return (
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 40,
          width: 880,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 104,
          color: KEY,
          ...stroke(20),
          scale: pop,
          filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.35))",
        }}
      >
        MALDIVAS
      </div>
    );
  }
  if (frame >= C5_85 && frame < C5_SCHOOL) {
    const n = Math.round(interpolate(frame, [C5_COUNT, C5_COUNT + COUNT_FRAMES], [0, 85], { ...clamp, easing: Easing.out(Easing.quad) }));
    const pop = spring({ frame: frame - C5_85, fps, config: { damping: 12, stiffness: 240, mass: 0.5 } });
    const done = spring({ frame: frame - (C5_COUNT + COUNT_FRAMES), fps, config: { damping: 7, stiffness: 240, mass: 0.5 } });
    return (
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 40,
          width: 880,
          textAlign: "center",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 300,
          letterSpacing: -8,
          color: KEY,
          ...stroke(34),
          scale: pop * (1 + 0.12 * done),
          fontVariantNumeric: "tabular-nums",
          filter: "drop-shadow(0 14px 0 rgba(0,0,0,0.35))",
        }}
      >
        {n}%
      </div>
    );
  }
  return null;
};

// ---------------------------------------------------------------------------
// Scenes 8-9: the two choice cards, "COMENTA A OU B" and the arrow
// ---------------------------------------------------------------------------
const CARD_W = 425;
const CANVAS_H = 640;
const Card: React.FC<{ which: "A" | "B"; from: number; x: number; color: string; label: string }> = ({ which, from, x, color, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from) return null;
  const pop = spring({ frame: frame - from, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });
  // scene 9: the cards get shorter to make room for the call to comment
  const h = interpolate(frame, [S[8], S[8] + 10], [900, 700], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const beat = frame >= S[8] ? 0.018 * Math.sin((frame - S[8]) * 0.32 + (which === "A" ? 0 : Math.PI)) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 268,
        width: CARD_W,
        height: h,
        boxSizing: "border-box",
        border: `10px solid ${color}`,
        borderRadius: 34,
        background: "#07142c",
        overflow: "hidden",
        scale: interpolate(pop, [0, 1], [0.1, 1]) * (1 + beat),
        rotate: `${interpolate(pop, [0, 1], [which === "A" ? -14 : 14, 0])}deg`,
        boxShadow: `0 0 0 5px ${INK}, 0 18px 40px rgba(0,0,0,0.6)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 170, lineHeight: "160px", height: 160, textAlign: "center", color, ...stroke(18), flexShrink: 0 }}>
        {which}
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden", borderTop: `6px solid ${color}`, borderBottom: `6px solid ${color}` }}>
        <div style={{ position: "absolute", left: 0, top: "50%", marginTop: -CANVAS_H / 2, width: CARD_W - 20, height: CANVAS_H }}>
          <CardCanvas which={which} width={CARD_W - 20} height={CANVAS_H} />
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 38,
          lineHeight: "88px",
          height: 84,
          textAlign: "center",
          color: "#fff",
          whiteSpace: "nowrap",
          letterSpacing: -0.5,
          flexShrink: 0,
          ...stroke(9),
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const Choice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C8_A - 4) return null;
  const dim = interpolate(frame, [C8_A - 4, C8_A + 6], [0, 0.6], clamp);
  const k = frame - S[8];
  const pop = spring({ frame: k - 4, fps, config: { damping: 10, stiffness: 220, mass: 0.6 } });
  const ax = 610 + 46 * Math.sin(k * 0.42);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(2,6,20,${dim})` }} />
      <Card which="A" from={C8_A} x={40} color="#1fd8c9" label="SACO DE BABA" />
      <Card which="B" from={C8_B} x={485} color="#ff8a2a" label="FENDA NO CORAL" />
      {k >= 4 && (
        <>
          <div
            style={{
              position: "absolute",
              top: 992,
              left: 30,
              width: 900,
              textAlign: "center",
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 92,
              letterSpacing: -2,
              whiteSpace: "nowrap",
              color: "#fff",
              ...stroke(20),
              scale: interpolate(pop, [0, 1], [0.3, 1]) * (1 + 0.02 * Math.sin(k * 0.32)),
              filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.4))",
            }}
          >
            COMENTA <span style={{ color: KEY }}>A</span> OU <span style={{ color: KEY }}>B</span>
          </div>
          {/* arrow towards the comments button (right edge, y ~1150), stopping short of it */}
          <svg width={250} height={120} viewBox="0 0 250 120" style={{ position: "absolute", left: ax, top: 1092, scale: pop, transformOrigin: "0% 50%" }}>
            <path d="M12 42 H140 V12 L238 60 L140 108 V78 H12 Z" fill={KEY} stroke={INK} strokeWidth={12} strokeLinejoin="round" />
          </svg>
        </>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Camera layer: whip blur on the cuts, flashes, grading
// ---------------------------------------------------------------------------
export const CameraLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  let blur = 0;
  let tx = 0;
  let ty = 0;
  WHIPS.forEach((w, i) => {
    const d = frame - w;
    if (d >= -3 && d <= 3) {
      const k = 1 - Math.abs(d) / 4;
      blur = 16 * k;
      const dir = i % 2 ? 1 : -1;
      if (w === C1_RISE) ty = (d < 0 ? 1 : -1) * 90 * k;
      else tx = (d < 0 ? -1 : 1) * dir * 110 * k;
    }
  });
  // punch on the impacts
  const punch = [C2_BITE, C3_CLANK].reduce((a, c) => Math.max(a, frame >= c && frame < c + 8 ? 0.05 * (1 - (frame - c) / 8) : 0), 0);
  const freeze = frame >= C3_CLANK && frame < C3_CLANK + FREEZE ? 0.012 * (frame - C3_CLANK) : 0;
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${tx}px, ${ty}px) scale(${1.02 + punch + freeze + (blur > 0 ? 0.08 : 0)})`,
        filter: `saturate(1.12) contrast(1.05)${blur > 0.2 ? ` blur(${blur.toFixed(1)}px)` : ""}`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = (c: number, len: number, a: number) => (frame >= c - 1 && frame < c + len ? a * (1 - Math.max(0, frame - c) / len) : 0);
  const white = Math.max(flash(C1_ISLAND, 7, 0.95), flash(C2_BITE, 4, 0.5), flash(C3_CLANK, 3, 0.55), flash(C5_GLOBE, 3, 0.25));
  const red = flash(C6_DROP, 10, 0.16);
  const memory = frame >= S[6] && frame < C7_NIGHT;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {memory && (
        <>
          <AbsoluteFill style={{ background: "rgba(255,196,84,0.2)", mixBlendMode: "multiply" }} />
          <AbsoluteFill style={{ background: "rgba(255,220,150,0.12)" }} />
          <AbsoluteFill style={{ boxShadow: "inset 0 0 260px 60px rgba(255,236,190,0.75)" }} />
        </>
      )}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,10,30,0.42) 100%)" }} />
      {red > 0 && <AbsoluteFill style={{ background: `rgba(230,20,40,${red})` }} />}
      {white > 0 && <AbsoluteFill style={{ background: `rgba(255,255,255,${white})` }} />}
      {frame >= DURATION - 1 && null}
    </AbsoluteFill>
  );
};
