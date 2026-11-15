// "Peixe-papagaio – parte 3/3": everything 2D on top of the 3D (same style as parts 1 and 2): karaoke
// captions, the small series badge (first 3 s only), giant yellow labels, the vote bubbles, the energy bar
// (the parte 2 battery), the small check, the arrow, the call to comment.
// TikTok safe area: nothing important in the top 150 px, bottom 420 px, right 160 px. No emojis.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../venus/Overlays";
import {
  at,
  BADGE_END,
  BUBBLE_COUNT,
  BUBBLE_GAP,
  C1_SEXO,
  C2_BAD,
  C2_BUBBLES,
  C2_VOTE,
  C3_BATTERY,
  C3_NADA,
  C3_WEAK,
  C3_WORST,
  C5_CHECK,
  C5_GROUP,
  C6_ARROW,
  C6_COLORS,
  C7_KILOS,
  C7_TONS,
  C8_ASK,
  C8_COMENTA,
  C8_FEMEA,
  C8_ILHA,
  C8_MACHO,
  DURATION,
  S,
  sceneEnd,
  sceneOf,
  WHIPS,
} from "./timeline";
import { NARRATION } from "./words";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const KEY = "#FFD23F";
const RED = "#ff3b3b";
const INK = "#0b1c22";
const stroke = (px: number): React.CSSProperties => ({ WebkitTextStroke: `${px}px ${INK}`, paintOrder: "stroke fill" });
const big = (size: number, color = "#fff", px = 20): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 900,
  fontSize: size,
  color,
  letterSpacing: -2,
  lineHeight: 0.98,
  whiteSpace: "nowrap",
  ...stroke(px),
});
const pop = (frame: number, from: number, fps: number, damping = 10) => spring({ frame: frame - from, fps, config: { damping, stiffness: 230, mass: 0.55 } });
// Every big label lives in ONE box centred on the real centre of the frame (x = 540): x 160..920 = 760 px,
// inside the TikTok safe area (160 px on the right). Labels end and stay at 0 degrees: only a short
// wobble while popping in (at most 3 degrees, 8 frames).
const LABEL_BOX: React.CSSProperties = { position: "absolute", left: 160, width: 760, textAlign: "center" };
const tilt = (frame: number, from: number, startDeg = -3) => `${interpolate(frame - from, [0, 8], [startDeg, 0], clamp)}deg`;

// ---------------------------------------------------------------------------
// Captions: 1-3 words at a time, exactly the narration (same look as parts 1 and 2)
// ---------------------------------------------------------------------------
type W = { text: string; key: boolean; start: number };
type Chunk = { words: W[]; start: number; end: number };
export const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  NARRATION.forEach((n, si) => {
    let wi = 0;
    n.text.split(" | ").forEach((c) => {
      const words = c.split(" ").map((raw) => ({ text: raw.replace(/\*/g, ""), key: raw.includes("*"), start: at(si, n.t[wi++]) }));
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
const CAPTION_WIDTH = 1080 - 150 - 150;
/** a chunk that is only a little too wide for one line (up to 20%) gets a slightly smaller font instead of
 *  wrapping, so no word is left alone on a line ("O" / "peixe-papagaio"); longer chunks still wrap as before.
 *  Measured with the caption font itself (canvas measureText). The words never change. */
const captionSize = (words: string[]) => {
  try {
    const g = document.createElement("canvas").getContext("2d");
    if (!g) return CAPTION_SIZE;
    g.font = `900 ${CAPTION_SIZE}px ${FONT}`;
    const w = words.reduce((a, t) => a + g.measureText(t).width - (t.length - 1), 0) + CAPTION_SIZE * 0.6 * (words.length - 1) + 22;
    return w > CAPTION_WIDTH && w <= CAPTION_WIDTH * 1.2 ? Math.floor((CAPTION_SIZE * (CAPTION_WIDTH - 4)) / w) : CAPTION_SIZE;
  } catch {
    return CAPTION_SIZE;
  }
};
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = CHUNKS.find((x) => frame >= x.start && frame < x.end);
  if (!c) return null;
  const size = captionSize(c.words.map((w) => w.text));
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
        columnGap: size < CAPTION_SIZE ? size * 0.6 : size * 0.5, // air between the words (thicker outline)
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: -1,
        scale: interpolate(enter, [0, 1], [0.86, 1]),
        transformOrigin: "50% 40%",
      }}
    >
      {c.words.map((w, i) => {
        const end = i + 1 < c.words.length ? c.words[i + 1].start : c.end;
        const e2 = Math.max(end, w.start + 3);
        // the very first word is already lit on frame 0 (the hook reads from the first frame)
        const on = w.start === 0 && frame < 3 ? 1 : interpolate(frame, [w.start - 2, w.start + 1, e2 - 1, e2 + 2], [0, 1, 1, 0], clamp);
        const hop = w.key ? 0.08 * Math.max(0, Math.sin((Math.PI * (frame - w.start + 1)) / 8)) * (frame - w.start < 8 ? 1 : 0) : 0;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              color: w.key ? KEY : "#ffffff",
              ...stroke(21),
              // words not spoken yet: white at 75% (never below 70%), the spoken word at 100%
              opacity: 0.75 + 0.25 * on,
              // long words grow less when spoken, so they never cover the word next to them ("Um peixe-papagaio")
              scale: 1 + (0.07 * on + hop) * Math.min(1, 4 / w.text.length),
              transformOrigin: "50% 80%",
              filter: "drop-shadow(0 5px 0 rgba(0,0,0,0.9)) drop-shadow(0 10px 16px rgba(0,0,0,0.7))",
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
// Series badge: PARTE 3/3, ~70% of the parte 2 badge, only the first 3 s, short fade out
// ---------------------------------------------------------------------------
export const Badge: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame >= BADGE_END) return null;
  const o = interpolate(frame, [BADGE_END - 6, BADGE_END], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        top: 180,
        opacity: o,
        background: KEY,
        color: "#000",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 24,
        letterSpacing: 0.7,
        padding: "6px 13px 4px",
        borderRadius: 7,
        border: `3px solid ${INK}`,
        boxShadow: "0 4px 0 rgba(0,0,0,0.35)",
      }}
    >
      PARTE 3/3
    </div>
  );
};

// ---------------------------------------------------------------------------
// Giant yellow labels (upper third) with a pop
// ---------------------------------------------------------------------------
const LABELS: { from: number; to: number; lines: string[]; size: number; top?: number }[] = [
  { from: C1_SEXO, to: S[1], lines: ["MUDA", "DE SEXO"], size: 132 },
  { from: C7_KILOS, to: C7_TONS, lines: ["DEZENAS", "DE QUILOS"], size: 100 },
  { from: C7_TONS, to: sceneEnd(6), lines: ["TONELADAS"], size: 104 },
  // scene 8: at the safe top (never over the island)
  { from: C8_FEMEA, to: C8_MACHO, lines: ["FÊMEA"], size: 140, top: 175 },
  { from: C8_MACHO, to: C8_ILHA, lines: ["MACHO"], size: 140, top: 175 },
  { from: C8_ILHA, to: C8_ASK - 6, lines: ["ILHA"], size: 150, top: 175 },
];
export const Labels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = LABELS.find((x) => frame >= x.from && frame < x.to);
  if (!l) return null;
  const p = spring({ frame: frame - l.from, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  return (
    <div
      style={{
        ...LABEL_BOX,
        top: l.top ?? 290,
        ...big(l.size, KEY, 24),
        scale: interpolate(p, [0, 1], [0.2, 1]) * (1 + 0.015 * Math.sin(frame * 0.3)),
        rotate: tilt(frame, l.from),
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
// Scene 2: comment bubbles with a yellow "B" (no names, no photos), VOCÊS VOTARAM: B, PÉSSIMA IDEIA
// ---------------------------------------------------------------------------
const BUBBLES = [
  { x: 120, y: 1080, s: 1.0 },
  { x: 610, y: 1010, s: 0.9 },
  { x: 330, y: 940, s: 1.1 },
  { x: 700, y: 860, s: 0.85 },
  { x: 170, y: 790, s: 0.95 },
  { x: 480, y: 730, s: 1.0 },
];
export const bubbleFrames = () => Array.from({ length: BUBBLE_COUNT }, (_, i) => C2_BUBBLES + i * BUBBLE_GAP);
const Bubble: React.FC<{ x: number; y: number; s: number; from: number; frame: number; fps: number; fade: number }> = ({ x, y, s, from, frame, fps, fade }) => {
  if (frame < from) return null;
  const p = pop(frame, from, fps, 9);
  const rise = (frame - from) * 1.6;
  return (
    <svg width={190} height={150} viewBox="0 0 190 150" style={{ position: "absolute", left: x, top: y - rise, scale: p * s, opacity: fade, filter: "drop-shadow(0 8px 0 rgba(0,0,0,0.3))" }}>
      <path d="M30 10 H160 Q182 10 182 32 V92 Q182 114 160 114 H78 L46 142 L52 114 H30 Q8 114 8 92 V32 Q8 10 30 10 Z" fill="#fff" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      <text x={95} y={92} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={82} fill={KEY} stroke={INK} strokeWidth={9} paintOrder="stroke">
        B
      </text>
    </svg>
  );
};
export const Vote: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < S[1] || frame >= S[2]) return null;
  const fade = interpolate(frame, [C2_BAD - 6, C2_BAD + 2], [1, 0], clamp);
  const v = pop(frame, C2_VOTE, fps, 9);
  const b = pop(frame, C2_BAD, fps, 8);
  const cold = interpolate(frame, [C2_BAD, C2_BAD + 10], [0, 1], clamp);
  return (
    <AbsoluteFill>
      {/* the paradise cools down: paler, colder */}
      <AbsoluteFill style={{ background: `rgba(150,170,190,${0.32 * cold})`, mixBlendMode: "saturation" }} />
      <AbsoluteFill style={{ background: `rgba(30,50,80,${0.22 * cold})` }} />
      {fade > 0 && BUBBLES.map((q, i) => <Bubble key={i} {...q} from={bubbleFrames()[i]} frame={frame} fps={fps} fade={fade} />)}
      {frame >= C2_VOTE && (
        <div style={{ ...LABEL_BOX, top: 300, scale: interpolate(v, [0, 1], [0.2, 1]), rotate: tilt(frame, C2_VOTE), filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.4))" }}>
          <div style={big(68, "#fff", 16)}>VOCÊS VOTARAM:</div>
          <div style={{ ...big(250, KEY, 32), lineHeight: 0.95 }}>B</div>
        </div>
      )}
      {frame >= C2_BAD && (
        <div style={{ ...LABEL_BOX, top: 760, ...big(122, RED, 24), scale: interpolate(b, [0, 1], [0.2, 1]) * (1 + 0.015 * Math.sin(frame * 0.4)), rotate: tilt(frame, C2_BAD, 3), filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.4))" }}>
          <div>PÉSSIMA</div>
          <div>IDEIA</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Scene 3: the energy bar (the parte 2 battery) drains with the narration; red on "mais fraco"
// ---------------------------------------------------------------------------
export const BATTERY_STEPS = [0, 1, 2, 3].map((k) => C3_BATTERY + 6 + Math.round(((C3_WEAK - C3_BATTERY - 6) * (k + 1)) / 4));
export const Battery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C3_BATTERY || frame >= S[3]) return null;
  const p = pop(frame, C3_BATTERY, fps, 11);
  const W = 400;
  const inner = W - 24 - 8;
  // drains in 4 steps with the narration, down to a thin red sliver on "mais fraco"
  const level = BATTERY_STEPS.reduce((lv, st, i) => lv - (0.21 + (i === 3 ? 0.03 : 0)) * interpolate(frame, [st - 6, st], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }), 1);
  const weak = frame >= C3_WEAK;
  const blink = weak && Math.floor((frame - C3_WEAK) / 4) % 2 === 0;
  const color = weak ? (blink ? "#ff2f3a" : "#c81e28") : level < 0.45 ? "#ff8a2a" : KEY;
  const wp = pop(frame, C3_WEAK, fps, 8);
  return (
    <div style={{ position: "absolute", left: 60, top: 190, scale: p * (weak ? 1 + 0.06 * Math.max(0, 1 - (frame - C3_WEAK) / 10) * wp : 1), transformOrigin: "0% 50%" }}>
      <div style={{ position: "relative", width: W, height: 118, boxSizing: "border-box", border: `12px solid #fff`, borderRadius: 22, boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px rgba(0,0,0,0.35)`, background: "rgba(4,10,30,0.8)" }}>
        <div
          style={{
            position: "absolute",
            left: 4,
            top: 4,
            bottom: 4,
            width: Math.max(10, inner * level - 3),
            background: color,
            borderRadius: 8,
            boxShadow: weak && blink ? "0 0 14px 5px rgba(255,40,50,0.9)" : undefined,
          }}
        />
        <div style={{ position: "absolute", right: -34, top: 27, width: 22, height: 40, background: "#fff", borderRadius: 6, boxShadow: `0 0 0 6px ${INK}` }} />
      </div>
      <div style={{ position: "absolute", left: W + 44, top: 18, ...big(64, weak ? RED : "#fff", 14), letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>{Math.round(level * 100)}%</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 5: small green check + "A" (no comment bubbles here)
// ---------------------------------------------------------------------------
export const Check: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C5_CHECK - 1 || frame >= C5_GROUP) return null;
  const p = pop(frame, C5_CHECK - 1, fps, 8);
  const draw = interpolate(frame, [C5_CHECK + 1, C5_CHECK + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const o = interpolate(frame, [C5_GROUP - 8, C5_GROUP], [1, 0], clamp);
  return (
    // translate: the glyph "A" has a wider left side bearing; +5 px puts the VISIBLE pair on x = 540
    <div style={{ ...LABEL_BOX, top: 300, display: "flex", justifyContent: "center", alignItems: "center", gap: 22, translate: "5px 0px", scale: p, opacity: o, filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.35))" }}>
      <div style={{ ...big(130, KEY, 22) }}>A</div>
      <svg width={150} height={150} viewBox="0 0 400 400">
        <circle cx={200} cy={200} r={176} fill="#2fd25e" stroke={INK} strokeWidth={22} />
        <path d="M112 206 L176 268 L292 140" fill="none" stroke={INK} strokeWidth={64} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <path d="M112 206 L176 268 L292 140" fill="none" stroke="#fff" strokeWidth={38} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 6: a small yellow arrow pointing at you ("E a maior… é você")
// ---------------------------------------------------------------------------
export const ARROW6 = { x: 540 - 70, y: 770 };
export const YouArrow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C6_ARROW || frame >= C6_COLORS) return null;
  const p = pop(frame, C6_ARROW, fps, 9);
  const bob = 14 * Math.sin((frame - C6_ARROW) * 0.35);
  return (
    <svg width={140} height={170} viewBox="0 0 140 170" style={{ position: "absolute", left: ARROW6.x, top: ARROW6.y + bob, scale: p, transformOrigin: "50% 100%", filter: "drop-shadow(0 8px 0 rgba(0,0,0,0.35))" }}>
      <path d="M42 8 H98 V92 H132 L70 162 L8 92 H42 Z" fill={KEY} stroke={INK} strokeWidth={10} strokeLinejoin="round" />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Scene 8: QUAL ANIMAL?, then COMENTA + the arrow to the comments button + the promise
// ---------------------------------------------------------------------------
const Arrow: React.FC<{ k: number; p: number }> = ({ k, p }) => (
  // towards the comments button (right edge, y ~1150), stopping short of it (never under it)
  <svg width={250} height={120} viewBox="0 0 250 120" style={{ position: "absolute", left: 610 + 46 * Math.sin(k * 0.42), top: 1092, scale: p, transformOrigin: "0% 50%" }}>
    <path d="M12 42 H140 V12 L238 60 L140 108 V78 H12 Z" fill={KEY} stroke={INK} strokeWidth={12} strokeLinejoin="round" />
  </svg>
);
export const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C8_ASK - 2 || frame >= DURATION) return null;
  // no full-screen grey: only soft dark bands behind the texts, the island and the fish stay bright
  const dim = interpolate(frame, [C8_ASK - 2, C8_ASK + 6], [0, 1], clamp);
  const band = (top: number, h: number, a: number) => (
    <div style={{ position: "absolute", left: 0, right: 0, top, height: h, opacity: dim, background: `linear-gradient(rgba(2,10,30,0) 0%, rgba(2,10,30,${a}) 22%, rgba(2,10,30,${a}) 78%, rgba(2,10,30,0) 100%)` }} />
  );
  const q = pop(frame, C8_ASK, fps, 9);
  const c = pop(frame, C8_COMENTA, fps, 9);
  const k = frame - C8_COMENTA;
  return (
    <AbsoluteFill>
      {band(280, 560, 0.42)}
      {frame >= C8_COMENTA - 2 && band(890, 340, 0.38)}
      <div style={{ ...LABEL_BOX, top: 330, scale: interpolate(q, [0, 1], [0.2, 1]) * (1 + 0.015 * Math.sin(frame * 0.3)), rotate: tilt(frame, C8_ASK), filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.4))" }}>
        <div style={big(128, KEY, 26)}>QUAL</div>
        <div style={big(128, KEY, 26)}>ANIMAL?</div>
      </div>
      {/* the promise, together with the question (from "Qual animal"): 2 centred lines, letters ~50 px high,
          between the question and COMENTA (never under the comments button) */}
      <div style={{ ...LABEL_BOX, top: 625, ...big(70, "#fff", 14), letterSpacing: -3, lineHeight: 1.1, opacity: interpolate(frame, [C8_ASK + 6, C8_ASK + 12], [0, 1], clamp), filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.4))" }}>
        <div>O MAIS PEDIDO VIRA</div>
        <div>O PRÓXIMO VÍDEO</div>
      </div>
      {frame >= C8_COMENTA && (
        <>
          <div style={{ ...LABEL_BOX, top: 930, ...big(118, "#fff", 22), scale: interpolate(c, [0, 1], [0.3, 1]) * (1 + 0.02 * Math.sin(k * 0.32)), rotate: tilt(frame, C8_COMENTA), filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.4))" }}>
            COMENTA
          </div>
          <Arrow k={k} p={c} />
        </>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Camera layer: whip blur on the 4 real cuts; short zoom shake on "muda de sexo"; quick zoom on
// "Mas o pior"; the cold grade of the lagoon scenes
// ---------------------------------------------------------------------------
export const CameraLayer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  let blur = 0;
  let tx = 0;
  WHIPS.forEach((w, i) => {
    const d = frame - w;
    if (d >= -3 && d <= 3) {
      const k = 1 - Math.abs(d) / 4;
      blur = 16 * k;
      // the slide never exceeds what the zoom covers (1080 * 0.10 / 2 = 54 px): no empty band at the edges
      tx = (d < 0 ? -1 : 1) * (i % 2 ? 1 : -1) * 48 * k;
    }
  });
  // "muda de sexo": short zoom + light shake
  const s1 = frame - C1_SEXO;
  const sexo = s1 >= 0 && s1 < 12 ? 1 - s1 / 12 : 0;
  const shake = sexo * 12 * Math.sin(s1 * 2.4);
  // "Mas o pior": a quick zoom that holds
  const worst = frame >= C3_WORST && frame < S[3] ? interpolate(frame, [C3_WORST, C3_WORST + 5], [0, 0.06], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const sc = sceneOf(frame);
  const sat = sc === 2 ? 0.78 : sc === 3 ? 0.95 : 1.12;
  const still = frame >= C3_NADA && frame < C3_NADA + 12 ? 0.6 : 1; // "Nada": the colour drains for a beat
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${tx + shake}px, ${shake * 0.4}px) scale(${1.02 + 0.07 * sexo + worst + (blur > 0 ? 0.1 : 0)})`,
        filter: `saturate(${(sat * still).toFixed(2)}) contrast(1.05)${blur > 0.2 ? ` blur(${blur.toFixed(1)}px)` : ""}`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const FG_SCENES = [0, 2, 6];
const blade = (x: number, h: number, bend: number, w: number) => `M${x - w} 1920 C ${x - w} ${1920 - h * 0.5}, ${x + bend - w * 0.4} ${1920 - h * 0.8}, ${x + bend} ${1920 - h} C ${x + bend + w * 0.4} ${1920 - h * 0.8}, ${x + w} ${1920 - h * 0.5}, ${x + w} 1920 Z`;
export const Foreground: React.FC = () => {
  const frame = useCurrentFrame();
  const sc = sceneOf(frame);
  if (!FG_SCENES.includes(sc)) return null;
  const s1 = Math.sin(frame * 0.05);
  const s2 = Math.sin(frame * 0.043 + 1.3);
  const o = interpolate(frame - S[sc], [0, 4], [sc === 0 ? 1 : 0, 1], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: o }}>
      {/* left edge: seagrass + a coral fan, blurred like the near plane of a shallow depth of field */}
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, filter: "blur(14px)" }}>
        <g fill="#0f3d3a" opacity={0.92}>
          <path d={blade(-10, 760, 60 + 25 * s1, 26)} />
          <path d={blade(40, 980, 110 + 30 * s2, 22)} />
          <path d={blade(95, 640, 70 + 20 * s1, 20)} />
          <path d={blade(1060, 820, -70 - 25 * s2, 26)} />
          <path d={blade(1010, 600, -90 - 20 * s1, 20)} />
        </g>
        <g fill="#7a3a26" opacity={0.85}>
          <ellipse cx={1085} cy={1560} rx={120} ry={190} />
          <ellipse cx={-30} cy={1680} rx={110} ry={150} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = (c: number, len: number, a: number) => (frame >= c - 1 && frame < c + len ? a * (1 - Math.max(0, frame - c) / len) : 0);
  const white = Math.max(flash(C1_SEXO, 4, 0.35), flash(C5_CHECK, 4, 0.2));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,10,30,0.42) 100%)" }} />
      {white > 0 && <AbsoluteFill style={{ background: `rgba(255,255,255,${white})` }} />}
      {/* scene 6: the small fish behind the caption lower its contrast: darken that strip a little */}
      {frame >= S[5] && frame < S[6] && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 1170, height: 360, background: "linear-gradient(rgba(0,12,30,0) 0%, rgba(0,12,30,0.38) 30%, rgba(0,12,30,0.38) 70%, rgba(0,12,30,0) 100%)" }} />
      )}
    </AbsoluteFill>
  );
};
