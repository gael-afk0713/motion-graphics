import { loadFont } from "@remotion/fonts";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { blockStart, blockWords, CAPTIONS, spokenFrame } from "./captions";
import { ORBIT, SPIN_COUNTER } from "./timeline";

// Montserrat variable font (bundled locally in public/fonts)
const montserrat = "Montserrat";
loadFont({
  family: montserrat,
  url: staticFile("fonts/montserrat-latin.woff2"),
  weight: "100 900",
  unicodeRange:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
});
loadFont({
  family: montserrat,
  url: staticFile("fonts/montserrat-latin-ext.woff2"),
  weight: "100 900",
  unicodeRange:
    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
});

export const FONT = `${montserrat}, "Noto Color Emoji", sans-serif`;
export const YELLOW = "#FFD23F";
export const SAFE_Y = 150;
const SIDE = 80;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const textShadow =
  "0 4px 0 rgba(0,0,0,0.55), 0 10px 40px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)";

const Caption: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const block = CAPTIONS[index];
  const start = blockStart(block);
  const next = index + 1 < CAPTIONS.length ? blockStart(CAPTIONS[index + 1]) : Infinity;
  if (frame < start || frame >= next) return null;
  // Old caption is gone exactly when the next one's first word pops in
  const out = Number.isFinite(next) ? interpolate(frame, [next - 3, next], [1, 0], clamp) : 1;
  const { fontSize, center } = block;
  return (
    <div
      style={{
        position: "absolute",
        top: center ? 0 : SAFE_Y + 40,
        bottom: center ? 0 : undefined,
        left: SIDE,
        right: SIDE,
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "flex-start",
        opacity: out,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.08,
          color: "white",
          textAlign: "center",
          textShadow,
          letterSpacing: -1,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: fontSize * 0.26,
        }}
      >
        {blockWords(block).map((w, i) => {
          // Words not yet spoken are invisible but keep their place
          const s =
            frame < w.appearAt
              ? 0
              : spring({
                  // +1: already visible on its first frame (LEAD frames before the voice)
                  frame: frame - w.appearAt + 1,
                  fps,
                  config: { damping: 14, stiffness: 200, mass: 0.5 },
                });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: w.key ? YELLOW : "white",
                opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
                scale: interpolate(s, [0, 1], [w.key ? 1.25 : 0.7, 1]),
                translate: `0px ${interpolate(s, [0, 1], [30, 0])}px`,
                textShadow: w.key
                  ? `${textShadow}, 0 0 30px rgba(255,190,40,0.55)`
                  : textShadow,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** All captions, on absolute video time (independent of scene cuts). */
export const Captions: React.FC = () => (
  <AbsoluteFill>
    {CAPTIONS.map((c, i) => (
      <Caption key={c.id} index={i} />
    ))}
  </AbsoluteFill>
);

const Counter: React.FC<{
  value: number;
  label: string;
  progress: number;
  align: "left" | "right";
  appear: number;
}> = ({ value, label, progress, align, appear }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear, fps, config: { damping: 16, stiffness: 160 } });
  return (
    <div
      style={{
        position: "absolute",
        bottom: SAFE_Y + 30,
        [align]: SIDE,
        width: 470,
        padding: "26px 34px",
        borderRadius: 34,
        background: "rgba(10,10,24,0.62)",
        border: "2px solid rgba(255,210,63,0.45)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        fontFamily: FONT,
        color: "white",
        opacity: s,
        translate: `0px ${interpolate(s, [0, 1], [80, 0])}px`,
        textAlign: align,
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 3, opacity: 0.8 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: align === "left" ? "flex-start" : "flex-end",
          gap: 14,
        }}
      >
        <span
          style={{
            fontSize: 124,
            fontWeight: 900,
            color: YELLOW,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.05,
            textShadow: "0 0 30px rgba(255,190,40,0.45)",
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 44, fontWeight: 900 }}>DIAS</span>
      </div>
      <div
        style={{
          marginTop: 12,
          height: 14,
          borderRadius: 7,
          background: "rgba(255,255,255,0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            borderRadius: 7,
            background: `linear-gradient(90deg, #ff9a2e, ${YELLOW})`,
            marginLeft: align === "right" ? "auto" : 0,
          }}
        />
      </div>
    </div>
  );
};

/** `offset` = absolute frame of the scene sequence's local frame 0 */
type SceneProps = { offset: number };

// Counter climbs while "243" is being said and lands on 243 at "dias"
export const SceneSpin: React.FC<SceneProps> = ({ offset }) => {
  const abs = useCurrentFrame() + offset;
  const p = interpolate(abs, [SPIN_COUNTER.start, SPIN_COUNTER.end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.3, 0, 0.4, 1),
  });
  return (
    <AbsoluteFill>
      <Counter
        value={Math.round(p * 243)}
        label="1 ROTAÇÃO"
        progress={p}
        align="right"
        appear={SPIN_COUNTER.start - offset - 6}
      />
    </AbsoluteFill>
  );
};

export const SceneOrbit: React.FC<SceneProps> = ({ offset }) => {
  const abs = useCurrentFrame() + offset;
  const p = interpolate(abs, [ORBIT.start, ORBIT.end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  return (
    <AbsoluteFill>
      <Counter
        value={Math.round(p * 225)}
        label="1 VOLTA NO SOL"
        progress={p}
        align="left"
        appear={ORBIT.start - offset - 6}
      />
    </AbsoluteFill>
  );
};

// Cards come in dimmed; each one lights up only when its word is spoken
const CompareCard: React.FC<{
  title: string;
  value: number;
  sub: string;
  highlight: boolean;
  appear: number;
  litAt: number;
  blinkFrom: number;
}> = ({ title, value, sub, highlight, appear, litAt, blinkFrom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear, fps, config: { damping: 13, stiffness: 170 } });
  const isLit = frame >= litAt;
  const lit = isLit ? spring({ frame: frame - litAt + 1, fps, config: { damping: 12, stiffness: 220 } }) : 0;
  const accent = highlight ? YELLOW : "#ffffff";
  const blink =
    highlight && frame >= blinkFrom ? (Math.floor((frame - blinkFrom) / 4) % 2 === 0 ? 1 : 0.25) : 0;
  return (
    <div
      style={{
        width: 400,
        padding: "34px 10px 30px",
        borderRadius: 40,
        background: highlight && isLit ? "rgba(60,38,6,0.75)" : "rgba(14,14,30,0.72)",
        border: `4px solid ${isLit ? accent : "rgba(255,255,255,0.18)"}`,
        boxShadow: highlight && isLit
          ? `0 0 ${20 + blink * 70}px rgba(255,200,50,${0.25 + blink * 0.6})`
          : "0 20px 60px rgba(0,0,0,0.5)",
        textAlign: "center",
        fontFamily: FONT,
        color: "white",
        scale: interpolate(s, [0, 1], [0.4, 1]) * interpolate(lit, [0, 1], [0.94, 1]),
        opacity: interpolate(s, [0, 0.3], [0, 1], clamp) * interpolate(lit, [0, 1], [0.45, 1]),
      }}
    >
      <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: 2, color: isLit ? accent : "white" }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 170,
          fontWeight: 900,
          lineHeight: 1.05,
          color: highlight && isLit ? YELLOW : "white",
          textShadow:
            highlight && isLit ? `0 0 ${10 + blink * 40}px rgba(255,200,50,0.9)` : textShadow,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 38, fontWeight: 700, opacity: 0.85 }}>dias</div>
      <div style={{ marginTop: 14, fontSize: 30, fontWeight: 700, opacity: 0.65 }}>{sub}</div>
    </div>
  );
};

export const SceneCompare: React.FC<SceneProps> = ({ offset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const diaAt = spokenFrame("compare", "DIA") - offset;
  const anoAt = spokenFrame("compare", "ANO") - offset;
  const g =
    frame >= anoAt ? spring({ frame: frame - anoAt + 1, fps, config: { damping: 10, stiffness: 200 } }) : 0;
  const pulse = 1 + 0.12 * Math.max(0, Math.sin((frame - anoAt) * 0.8)) * (frame > anoAt ? 1 : 0);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          top: 820,
          height: 600,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CompareCard
          title="1 DIA"
          value={243}
          sub="1 giro"
          highlight
          appear={8}
          litAt={diaAt}
          blinkFrom={anoAt}
        />
        <div
          style={{
            width: 120,
            textAlign: "center",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 150,
            color: YELLOW,
            scale: g * pulse,
            textShadow: "0 0 40px rgba(255,190,40,0.8)",
          }}
        >
          &gt;
        </div>
        <CompareCard
          title="1 ANO"
          value={225}
          sub="1 volta no Sol"
          highlight={false}
          appear={11}
          litAt={anoAt}
          blinkFrom={Infinity}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const SceneOutro: React.FC<SceneProps> = ({ offset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const segueAt = spokenFrame("cta", "Segue") - offset;
  const s =
    frame >= segueAt
      ? spring({ frame: frame - segueAt + 1, fps, config: { damping: 12, stiffness: 170 } })
      : 0;
  return (
    <AbsoluteFill
      style={{ backgroundColor: `rgba(2,2,10,${interpolate(frame, [0, 10], [0, 0.35], clamp)})` }}
    >
      <div
        style={{
          position: "absolute",
          bottom: SAFE_Y + 120,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            padding: "24px 70px",
            borderRadius: 999,
            background: YELLOW,
            color: "#1a1200",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 56,
            letterSpacing: 2,
            scale: s * (1 + 0.05 * Math.sin(frame * 0.5)),
            boxShadow: "0 0 50px rgba(255,200,50,0.6)",
          }}
        >
          + SEGUIR
        </div>
      </div>
    </AbsoluteFill>
  );
};
