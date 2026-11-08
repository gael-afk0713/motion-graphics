import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, SAFE_Y, YELLOW } from "../venus/Overlays";
import { LINES, sceneWords } from "./captions";
import { at, S, sceneEnd } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SIDE = 80;
const textShadow = "0 4px 0 rgba(0,0,0,0.55), 0 10px 40px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)";

const CaptionBlock: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = sceneWords(index);
  const start = words[0].appearAt;
  const next = index + 1 < LINES.length ? sceneWords(index + 1)[0].appearAt : Infinity;
  if (frame < start || frame >= next) return null;
  const out = Number.isFinite(next) ? interpolate(frame, [next - 3, next], [1, 0], clamp) : 1;
  const { fontSize, allAtStart } = LINES[index];
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_Y + 30,
        left: SIDE,
        right: SIDE,
        opacity: out,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize,
        lineHeight: 1.08,
        color: "white",
        textAlign: "center",
        letterSpacing: -1,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: fontSize * 0.26,
      }}
    >
      {words.map((w, i) => {
        // Scene 1: fully visible from frame 0; keywords give a punch when spoken
        const s = allAtStart
          ? 1
          : frame < w.appearAt
            ? 0
            : spring({ frame: frame - w.appearAt + 1, fps, config: { damping: 14, stiffness: 200, mass: 0.5 } });
        const punch = allAtStart && w.key && frame >= w.spokenAt
          ? interpolate(frame - w.spokenAt, [0, 4, 12], [1, 1.14, 1], clamp)
          : 1;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: w.key ? YELLOW : "white",
              opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
              scale: interpolate(s, [0, 1], [w.key ? 1.25 : 0.7, 1]) * punch,
              translate: `0px ${interpolate(s, [0, 1], [30, 0])}px`,
              textShadow: w.key ? `${textShadow}, 0 0 30px rgba(255,190,40,0.55)` : textShadow,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

export const Captions: React.FC = () => (
  <AbsoluteFill>
    {LINES.map((_, i) => (
      <CaptionBlock key={i} index={i} />
    ))}
  </AbsoluteFill>
);

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV"];

// Scene 5: months counter 0 -> 10 with a calendar flipping pages
export const MonthsCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < S[4] || frame >= sceneEnd(4)) return null;
  const c0 = at(4, 0.25), c1 = at(4, 2.6);
  const prog = interpolate(frame, [c0, c1], [0, 10], { ...clamp, easing: Easing.bezier(0.3, 0, 0.5, 1) });
  const n = Math.floor(prog + 1e-6);
  // frame where the current value was reached (for the flip animation)
  const flip = interpolate(prog - n, [0, 0.35], [1, 0], clamp);
  const appear = spring({ frame: frame - S[4] + 1, fps, config: { damping: 15, stiffness: 180 } });
  const out = interpolate(frame, [sceneEnd(4) - 4, sceneEnd(4)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ backgroundColor: "rgba(2,14,28,0.45)" }} />
      <div
        style={{
          position: "absolute",
          top: 930,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 60,
          scale: interpolate(appear, [0, 1], [0.6, 1]),
          opacity: appear,
          fontFamily: FONT,
        }}
      >
        {/* calendar */}
        <div style={{ width: 300, height: 330, borderRadius: 34, background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.5)", overflow: "hidden", perspective: 800 }}>
          <div style={{ height: 90, background: "#E8443A", display: "flex", justifyContent: "center", gap: 70, alignItems: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff" }} />
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff" }} />
          </div>
          <div
            style={{
              height: 240,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 120,
              fontWeight: 900,
              color: "#12141C",
              transformOrigin: "50% 0%",
              rotate: `x ${-flip * 80}deg`,
              opacity: 1 - flip * 0.6,
            }}
          >
            {MONTHS[Math.min(n, MONTHS.length - 1)]}
          </div>
        </div>
        {/* counter */}
        <div style={{ textAlign: "center", color: "white" }}>
          <div style={{ fontSize: 300, fontWeight: 900, lineHeight: 0.95, color: YELLOW, fontVariantNumeric: "tabular-nums", textShadow: "0 0 40px rgba(255,190,40,0.6), 0 10px 30px rgba(0,0,0,0.6)" }}>
            {n}
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: 4, textShadow }}>{n === 1 ? "MÊS" : "MESES"}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 6: big pulsing question mark over the chloroplast
export const QuestionMark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < S[5] || frame >= sceneEnd(5)) return null;
  const s = spring({ frame: frame - (S[5] + 10), fps, config: { damping: 9, stiffness: 160 } });
  const pulse = 1 + 0.09 * Math.sin((frame - S[5]) * 0.42);
  const out = interpolate(frame, [sceneEnd(5) - 4, sceneEnd(5)], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 1120,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 460,
        lineHeight: 1,
        color: YELLOW,
        opacity: out * interpolate(s, [0, 0.3], [0, 1], clamp),
        scale: s * pulse,
        textShadow: "0 0 60px rgba(255,200,50,0.75), 0 14px 40px rgba(0,0,0,0.6)",
      }}
    >
      ?
    </div>
  );
};

export const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  // quick flash on the two hard cuts (into the chloroplast, back to the surface)
  const flash = Math.max(
    interpolate(frame, [S[5] - 2, S[5], S[5] + 7], [0, 0.65, 0], clamp),
    interpolate(frame, [S[6] - 2, S[6], S[6] + 7], [0, 0.55, 0], clamp),
  );
  return (
    <>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(0,8,20,0.6) 100%)" }} />
      <AbsoluteFill style={{ backgroundColor: "#e8fff0", opacity: flash }} />
    </>
  );
};
