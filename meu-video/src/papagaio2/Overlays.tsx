// "Peixe-papagaio – parte 2/3": everything 2D on top of the 3D (same style as parte 1): karaoke captions,
// series badge, the vote result, the clock, giant labels, the experiment's split screen and counters,
// the battery, the check, the A/B cards, the question mark, the arrow and the "@".
// TikTok safe area: nothing important in the top 150 px, bottom 420 px, right 160 px. No emojis.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../venus/Overlays";
import { CardCanvas, SplitCanvas } from "./Scene3D";
import {
  at,
  BADGE,
  C1_NIGHT,
  C1_RESULT,
  C2_HOUR,
  C2_LABEL,
  C2_PUSH,
  C4_10,
  C4_25,
  C4_95,
  C4_BACK,
  C4_BATTERY,
  C5_CHECK,
  C5_OUT,
  C7_A,
  C7_B,
  C8_NADA,
  C8_PULSES,
  C8_PUSH,
  PULSE_LEN,
  C9_BOX,
  C9_TYPE,
  C9_TEXT,
  C_DAWN,
  COUNT10_FRAMES,
  COUNT95_FRAMES,
  DURATION,
  S,
  sceneEnd,
  WHIPS,
} from "./timeline";
import { NARRATION } from "./words";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const KEY = "#FFD23F";
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

// ---------------------------------------------------------------------------
// Captions: 1-3 words at a time, exactly the narration (same look as parte 1)
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
        columnGap: CAPTION_SIZE * 0.42,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: CAPTION_SIZE,
        lineHeight: 1.1,
        letterSpacing: -1,
        scale: interpolate(enter, [0, 1], [0.86, 1]),
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
              // words not spoken yet: white at 75% (never below 70%), the spoken word at 100%
              opacity: 0.75 + 0.25 * on,
              scale: 1 + 0.07 * on + hop,
              transformOrigin: "50% 80%",
              filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.5))",
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
// Series badge: only the first 3 s and the card scenes (7-9), short fades
// ---------------------------------------------------------------------------
export const Badge: React.FC = () => {
  const frame = useCurrentFrame();
  const o = Math.max(
    0,
    ...BADGE.map(([a, b]) => {
      if (frame < a || frame >= b) return 0;
      const fin = a === 0 ? 1 : interpolate(frame, [a, a + 6], [0, 1], clamp);
      const fout = b >= DURATION ? 1 : interpolate(frame, [b - 6, b], [1, 0], clamp);
      return fin * fout;
    }),
  );
  if (o <= 0) return null;
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
        fontSize: 34,
        letterSpacing: 1,
        padding: "8px 18px 6px",
        borderRadius: 10,
        border: `4px solid ${INK}`,
        boxShadow: "0 6px 0 rgba(0,0,0,0.35)",
      }}
    >
      PARTE 2/3
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 1: the audience's answer: VOCÊ ESCOLHEU: A
// ---------------------------------------------------------------------------
export const VoteResult: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C1_NIGHT || frame >= S[1]) return null;
  const r = pop(frame, C1_RESULT, fps, 9);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(2,8,26,${interpolate(frame, [C1_NIGHT, C1_NIGHT + 8], [0, 0.35], clamp)})` }} />
      {frame >= C1_RESULT && (
        <div style={{ position: "absolute", top: 470, left: 40, width: 880, textAlign: "center", scale: interpolate(r, [0, 1], [0.2, 1]) * (1 + 0.02 * Math.sin(frame * 0.3)), rotate: `${interpolate(r, [0, 1], [-10, -3])}deg`, filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.4))" }}>
          <div style={big(80, "#fff", 18)}>VOCÊ ESCOLHEU:</div>
          <div style={{ ...big(330, KEY, 36), lineHeight: 0.95 }}>A</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
// ---------------------------------------------------------------------------
// Scene 2: the spinning clock (less than an hour) and the giant label
// ---------------------------------------------------------------------------
export const Clock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C2_HOUR || frame >= C2_PUSH + 4) return null;
  const k = frame - C2_HOUR;
  const p = pop(frame, C2_HOUR, fps) * interpolate(frame, [C2_PUSH - 2, C2_PUSH + 4], [1, 0], clamp);
  return (
    <svg width={170} height={170} viewBox="0 0 170 170" style={{ position: "absolute", left: 60, top: 190, scale: p }}>
      <circle cx={85} cy={85} r={72} fill="#fff" stroke={INK} strokeWidth={12} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={85} y1={24} x2={85} y2={i % 3 ? 32 : 38} stroke={INK} strokeWidth={i % 3 ? 4 : 7} strokeLinecap="round" transform={`rotate(${i * 30} 85 85)`} />
      ))}
      <line x1={85} y1={85} x2={85} y2={52} stroke={INK} strokeWidth={9} strokeLinecap="round" transform={`rotate(${k * 3} 85 85)`} />
      <line x1={85} y1={85} x2={85} y2={34} stroke="#e8423a" strokeWidth={6} strokeLinecap="round" transform={`rotate(${k * 36} 85 85)`} />
      <circle cx={85} cy={85} r={8} fill={INK} />
    </svg>
  );
};

const LABELS: { from: number; to: number; lines: string[]; size: number }[] = [{ from: C2_LABEL, to: sceneEnd(1), lines: ["MOSQUITEIRO"], size: 94 }];
export const ToolLabels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = LABELS.find((x) => frame >= x.from && frame < x.to);
  if (!l) return null;
  const p = spring({ frame: frame - l.from, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 300,
        left: 60,
        width: 840,
        textAlign: "center",
        ...big(l.size, KEY, 24),
        scale: interpolate(p, [0, 1], [0.2, 1]) * (1 + 0.015 * Math.sin(frame * 0.3)),
        rotate: `${interpolate(p, [0, 1], [-8, -3])}deg`,
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
// Scene 4: split screen (SEM BOLHA / COM BOLHA) + counters, then the battery
// ---------------------------------------------------------------------------
export const Split: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < S[3] || frame >= C4_BACK) return null;
  const n95 = Math.round(interpolate(frame, [C4_95, C4_95 + COUNT95_FRAMES], [0, 95], { ...clamp, easing: Easing.out(Easing.quad) }));
  const n10 = Math.round(interpolate(frame, [C4_10, C4_10 + COUNT10_FRAMES], [0, 10], { ...clamp, easing: Easing.out(Easing.quad) }));
  const in95 = pop(frame, C4_95 - 3, fps, 12);
  const in10 = pop(frame, C4_10 - 3, fps, 12);
  const done95 = spring({ frame: frame - (C4_95 + COUNT95_FRAMES), fps, config: { damping: 7, stiffness: 240, mass: 0.5 } });
  const done10 = spring({ frame: frame - (C4_10 + COUNT10_FRAMES), fps, config: { damping: 7, stiffness: 240, mass: 0.5 } });
  const lab = pop(frame, S[3] + 2, fps, 12);
  const label = (txt: string[], cx: number, color: string) => (
    <div style={{ position: "absolute", top: 210, left: cx - 200, width: 400, textAlign: "center", ...big(84, color, 18), scale: lab, filter: "drop-shadow(0 8px 0 rgba(0,0,0,0.4))" }}>
      {txt.map((t) => (
        <div key={t}>{t}</div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, width: 540, height: 1920 }}>
        <SplitCanvas side="L" />
      </div>
      <div style={{ position: "absolute", left: 540, top: 0, width: 540, height: 1920 }}>
        <SplitCanvas side="R" />
      </div>
      {/* divider */}
      <div style={{ position: "absolute", left: 531, top: 0, width: 18, height: 1920, background: "#fff", boxShadow: `0 0 0 5px ${INK}` }} />
      {label(["SEM", "BOLHA"], 270, "#fff")}
      {label(["COM", "BOLHA"], 730, "#fff")}
      {frame >= C4_95 - 3 && (
        <div style={{ position: "absolute", top: 420, left: 0, width: 540, textAlign: "center", ...big(176, "#ff3b3b", 26), letterSpacing: -6, fontVariantNumeric: "tabular-nums", scale: in95 * (1 + 0.12 * done95), filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.4))" }}>
          {n95}%
        </div>
      )}
      {frame >= C4_10 - 3 && (
        <div style={{ position: "absolute", top: 430, left: 540, width: 380, textAlign: "center", ...big(160, "#3ee06a", 24), letterSpacing: -6, fontVariantNumeric: "tabular-nums", scale: in10 * (1 + 0.12 * done10), filter: "drop-shadow(0 12px 0 rgba(0,0,0,0.4))" }}>
          {n10}%
        </div>
      )}
    </AbsoluteFill>
  );
};

export const Battery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C4_BATTERY || frame >= C5_CHECK - 2) return null;
  const p = pop(frame, C4_BATTERY, fps, 11);
  const out = interpolate(frame, [C5_CHECK - 8, C5_CHECK - 2], [1, 0], clamp);
  // a full battery that loses only a thin 2.5% slice: the slice blinks red three times, then drops away
  const W = 440;
  const inner = W - 24 - 8;
  const slice = inner * 0.025;
  const k = frame - C4_25;
  const blink = k >= 0 && k < 14 && Math.floor(k / 2.5) % 2 === 0;
  const gone = interpolate(k, [14, 24], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const t25 = pop(frame, C4_25, fps, 9);
  return (
    <div style={{ position: "absolute", left: 60, top: 200, scale: p, opacity: out, transformOrigin: "0% 50%" }}>
      <div style={{ position: "relative", width: W, height: 130, boxSizing: "border-box", border: `12px solid #fff`, borderRadius: 22, boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px rgba(0,0,0,0.35)`, background: "rgba(4,10,30,0.8)" }}>
        <div style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: inner - slice - 3, background: KEY, borderRadius: "8px 2px 2px 8px" }} />
        {gone < 1 && (
          <div
            style={{
              position: "absolute",
              left: 4 + inner - slice,
              top: 4,
              bottom: 4,
              width: slice,
              background: blink ? "#ff2f3a" : KEY,
              boxShadow: blink ? "0 0 14px 5px rgba(255,40,50,0.9)" : undefined,
              borderRadius: "2px 8px 8px 2px",
              opacity: 1 - gone,
              transform: `translateY(${70 * gone}px) rotate(${25 * gone}deg)`,
            }}
          />
        )}
        <div style={{ position: "absolute", right: -34, top: 33, width: 22, height: 40, background: "#fff", borderRadius: 6, boxShadow: `0 0 0 6px ${INK}` }} />
      </div>
      {k >= 0 && (
        <div style={{ position: "absolute", left: W + 46, top: 8, ...big(94, "#fff", 20), scale: t25, filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.4))" }}>
          <span style={{ color: "#ff3b3b" }}>-</span>
          <span style={{ color: KEY }}>2,5%</span>
        </div>
      )}
    </div>
  );
};
// ---------------------------------------------------------------------------
// Scene 5: the big green check
// ---------------------------------------------------------------------------
export const Check: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C5_CHECK - 1 || frame >= C5_OUT + 14) return null;
  const p = pop(frame, C5_CHECK - 1, fps, 8);
  const draw = interpolate(frame, [C5_CHECK + 1, C5_CHECK + 9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const o = interpolate(frame, [C5_OUT + 4, C5_OUT + 14], [1, 0], clamp);
  return (
    <svg width={400} height={400} viewBox="0 0 400 400" style={{ position: "absolute", left: 280, top: 400, scale: p, opacity: o, filter: "drop-shadow(0 14px 0 rgba(0,0,0,0.35))" }}>
      <circle cx={200} cy={200} r={176} fill="#2fd25e" stroke={INK} strokeWidth={16} />
      <path d="M112 206 L176 268 L292 140" fill="none" stroke={INK} strokeWidth={56} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      <path d="M112 206 L176 268 L292 140" fill="none" stroke="#fff" strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Scenes 7-9: the two choice cards (same style as parte 1), COMENTA A OU B, the ?, the arrow, the @
// ---------------------------------------------------------------------------
const CARD_W = 425;
const CANVAS_H = 640;
const Card: React.FC<{ which: "A" | "B"; from: number; x: number; color: string; label: string }> = ({ which, from, x, color, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from) return null;
  const p = spring({ frame: frame - from, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });
  // scene 8: shorter, to make room for the call to comment; scene 9: small, in the back (top), for the friend
  const q = interpolate(frame, [S[8], S[8] + 8], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const nine = frame >= S[8];
  const h = interpolate(frame, [S[7], S[7] + 10], [900, 700], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  // scene 8, from "uma delas te deixa sem nada": A and B pulse in turn (1.0 -> 1.06), with the tension beats
  const beat = C8_PULSES.reduce((m, at, i) => (i % 2 === (which === "A" ? 0 : 1) && frame >= at && frame < at + PULSE_LEN ? Math.max(m, 0.06 * Math.sin((Math.PI * (frame - at)) / PULSE_LEN)) : m), 0);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 268,
        translate: `${q * ((which === "A" ? 130 : 560) - x)}px ${q * 112}px`,
        transformOrigin: nine ? "0% 0%" : "50% 50%",
        width: CARD_W,
        height: h,
        boxSizing: "border-box",
        border: `10px solid ${color}`,
        borderRadius: 34,
        background: "#07142c",
        overflow: "hidden",
        scale: interpolate(p, [0, 1], [0.1, 1]) * (1 + beat) * interpolate(q, [0, 1], [1, 0.58]),
        rotate: `${interpolate(p, [0, 1], [which === "A" ? -14 : 14, 0])}deg`,
        boxShadow: `0 0 0 5px ${INK}, 0 18px 40px rgba(0,0,0,0.6)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 170, lineHeight: "160px", height: 160, textAlign: "center", color, ...stroke(18), flexShrink: 0 }}>{which}</div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden", borderTop: `6px solid ${color}`, borderBottom: `6px solid ${color}` }}>
        <div style={{ position: "absolute", left: 0, top: "50%", marginTop: -CANVAS_H / 2, width: CARD_W - 20, height: CANVAS_H }}>
          <CardCanvas which={which} width={CARD_W - 20} height={CANVAS_H} />
        </div>
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, lineHeight: "88px", height: 84, textAlign: "center", color: "#fff", whiteSpace: "nowrap", letterSpacing: -0.5, flexShrink: 0, ...stroke(9) }}>{label}</div>
    </div>
  );
};

const Arrow: React.FC<{ k: number; p: number }> = ({ k, p }) => (
  // towards the comments button (right edge, y ~1150), stopping short of it
  <svg width={250} height={120} viewBox="0 0 250 120" style={{ position: "absolute", left: 610 + 46 * Math.sin(k * 0.42), top: 1092, scale: p, transformOrigin: "0% 50%" }}>
    <path d="M12 42 H140 V12 L238 60 L140 108 V78 H12 Z" fill={KEY} stroke={INK} strokeWidth={12} strokeLinejoin="round" />
  </svg>
);

export const Choice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C7_A - 4) return null;
  const dim = interpolate(frame, [C7_A - 4, C7_A + 6], [0, 0.6], clamp) * interpolate(frame, [S[8], S[8] + 8], [1, 0.35], clamp);
  const k = frame - S[7];
  const p = pop(frame, S[7] + 4, fps);
  const in8 = frame >= S[7] && frame < S[8];
  const push = in8 ? 1 + 0.03 * interpolate(frame, [C8_PUSH, C8_PUSH + 24], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) }) : 1;
  const nk = frame - C8_NADA;
  const nada = in8 && nk >= 0 && nk < 14 ? 1 - nk / 14 : 0;
  const shake = nada * 14 * Math.sin(nk * 2.6);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(2,6,20,${Math.min(0.85, dim + nada * 0.25)})` }} />
      {/* scene 8: slow push-in on "Mas cuidado", a quick shake on "sem nada" */}
      <AbsoluteFill style={{ scale: push, translate: `${shake}px 0px`, transformOrigin: "50% 30%" }}>
        <Card which="A" from={C7_A} x={30} color="#1fd8c9" label="RECIFE DE FORA" />
        <Card which="B" from={C7_B} x={465} color="#ff8a2a" label="LAGOA CALMA" />
      </AbsoluteFill>
      {frame >= S[7] + 4 && frame < S[8] && (
        <div style={{ position: "absolute", top: 992, left: 30, width: 900, textAlign: "center", ...big(92, "#fff", 20), scale: interpolate(p, [0, 1], [0.3, 1]) * (1 + 0.02 * Math.sin(k * 0.32)), filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.4))" }}>
          COMENTA <span style={{ color: KEY }}>A</span> OU <span style={{ color: KEY }}>B</span>
        </div>
      )}
      {frame >= S[7] + 4 && frame < S[8] && <Arrow k={k} p={p} />}
    </AbsoluteFill>
  );
};

/** scene 9, inside the reef: a small title on top and a generic comment box (no app logo) typing "@" */
export const TagFriend: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < C9_TEXT) return null;
  const k = frame - C9_TEXT;
  const p = pop(frame, C9_TEXT, fps, 10);
  const bp = pop(frame, C9_BOX, fps, 11);
  const typed = frame >= C9_TYPE;
  const cursorOn = Math.floor((frame - C9_BOX) / 8) % 2 === 0;
  const at = pop(frame, C9_TYPE, fps, 9);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 252, left: 60, width: 840, textAlign: "center", ...big(58, "#fff", 14), letterSpacing: -1, scale: interpolate(p, [0, 1], [0.4, 1]) * (1 + 0.012 * Math.sin(k * 0.4)), filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.4))" }}>
        MARCA AQUELE <span style={{ color: KEY }}>AMIGO</span>
      </div>
      {frame >= C9_BOX && (
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 1062,
            width: 800,
            height: 150,
            boxSizing: "border-box",
            background: "#ffffff",
            borderRadius: 40,
            border: `6px solid ${INK}`,
            boxShadow: "0 12px 0 rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            gap: 26,
            padding: "0 30px",
            scale: bp,
            transformOrigin: "50% 100%",
          }}
        >
          {/* generic avatar */}
          <div style={{ width: 86, height: 86, borderRadius: 43, background: "#c9d2d8", flexShrink: 0, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 27, top: 16, width: 32, height: 32, borderRadius: 16, background: "#8a98a2" }} />
            <div style={{ position: "absolute", left: 13, top: 52, width: 60, height: 50, borderRadius: 30, background: "#8a98a2" }} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", fontFamily: FONT, fontWeight: 900, height: 100 }}>
            {typed && <span style={{ fontSize: 84, color: "#1d6fe0", scale: 0.7 + 0.3 * at, lineHeight: 1 }}>@</span>}
            <div style={{ width: 6, height: 70, background: INK, marginLeft: typed ? 8 : 0, marginRight: 12, borderRadius: 3, opacity: cursorOn ? 1 : 0 }} />
            {!typed && <span style={{ fontSize: 40, fontWeight: 700, color: "#9aa6ae", whiteSpace: "nowrap" }}>Comentar...</span>}
          </div>
          {/* generic send button */}
          <svg width={78} height={78} viewBox="0 0 78 78" style={{ flexShrink: 0 }}>
            <circle cx={39} cy={39} r={37} fill={typed ? KEY : "#d5dce0"} stroke={INK} strokeWidth={5} />
            <path d="M26 22 L58 39 L26 56 L31 39 Z" fill={INK} />
          </svg>
        </div>
      )}
    </AbsoluteFill>
  );
};
// ---------------------------------------------------------------------------
// Camera layer: whip blur on the cuts; grade + flashes
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
      tx = (d < 0 ? -1 : 1) * (i % 2 ? 1 : -1) * 110 * k;
    }
  });
  const punch = [C1_RESULT, C5_CHECK, C9_TEXT].reduce((a, c) => Math.max(a, frame >= c && frame < c + 8 ? 0.04 * (1 - (frame - c) / 8) : 0), 0);
  return (
    <AbsoluteFill style={{ transform: `translate(${tx}px, 0px) scale(${1.02 + punch + (blur > 0 ? 0.08 : 0)})`, filter: `saturate(1.12) contrast(1.05)${blur > 0.2 ? ` blur(${blur.toFixed(1)}px)` : ""}` }}>
      {children}
    </AbsoluteFill>
  );
};

export const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = (c: number, len: number, a: number) => (frame >= c - 1 && frame < c + len ? a * (1 - Math.max(0, frame - c) / len) : 0);
  const white = Math.max(flash(C1_NIGHT, 5, 0.5), flash(C5_CHECK, 4, 0.3), flash(C9_TEXT, 4, 0.45));
  // night -> dawn: a soft warm flash (no whip, no whoosh)
  const dawn = frame >= C_DAWN - 6 && frame < C_DAWN + 16 ? 0.55 * (frame < C_DAWN ? (frame - C_DAWN + 6) / 6 : 1 - (frame - C_DAWN) / 16) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,10,30,0.42) 100%)" }} />
      {dawn > 0 && <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 15%, rgba(255,246,214,${dawn}) 0%, rgba(255,236,190,${dawn * 0.7}) 60%, rgba(255,230,180,${dawn * 0.5}) 100%)` }} />}
      {white > 0 && <AbsoluteFill style={{ background: `rgba(255,255,255,${white})` }} />}
    </AbsoluteFill>
  );
};
