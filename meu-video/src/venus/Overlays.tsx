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

// Headline: words wrapped in *asterisks* are keywords rendered in yellow.
export const Headline: React.FC<{
  text: string;
  fontSize?: number;
  top?: number;
  delay?: number;
  center?: boolean;
}> = ({ text, fontSize = 104, top = SAFE_Y + 40, delay = 0, center = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div
      style={{
        position: "absolute",
        top: center ? 0 : top,
        bottom: center ? 0 : undefined,
        left: SIDE,
        right: SIDE,
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "flex-start",
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
        {words.map((w, i) => {
          const isKey = w.includes("*");
          const clean = w.replace(/\*/g, "");
          const s = spring({
            frame: frame - delay - i * 2.5,
            fps,
            config: { damping: 14, stiffness: 180, mass: 0.6 },
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: isKey ? YELLOW : "white",
                opacity: interpolate(s, [0, 0.4], [0, 1], clamp),
                scale: interpolate(s, [0, 1], [isKey ? 1.6 : 0.6, 1]),
                translate: `0px ${interpolate(s, [0, 1], [40, 0])}px`,
                textShadow: isKey
                  ? `${textShadow}, 0 0 30px rgba(255,190,40,0.55)`
                  : textShadow,
              }}
            >
              {clean}
            </span>
          );
        })}
      </div>
    </div>
  );
};

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

export const SceneIntro: React.FC = () => (
  <AbsoluteFill>
    <Headline text="Esse planeta *QUEBRA* as regras" fontSize={118} delay={8} />
  </AbsoluteFill>
);

export const SceneSpin: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const abs = frame + startFrame;
  const p = interpolate(abs, [SPIN_COUNTER.start, SPIN_COUNTER.end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.4, 0, 0.3, 1),
  });
  return (
    <AbsoluteFill>
      <Headline text="Vênus leva *243* *DIAS* para girar uma vez" fontSize={100} delay={6} />
      <Counter
        value={Math.round(p * 243)}
        label="1 ROTAÇÃO"
        progress={p}
        align="right"
        appear={SPIN_COUNTER.start - startFrame - 8}
      />
    </AbsoluteFill>
  );
};

export const SceneOrbit: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const abs = frame + startFrame;
  const p = interpolate(abs, [ORBIT.start, ORBIT.end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  return (
    <AbsoluteFill>
      <Headline text="Mas só *225* *dias* para dar a volta no *Sol*" fontSize={100} delay={6} />
      <Counter
        value={Math.round(p * 225)}
        label="1 VOLTA NO SOL"
        progress={p}
        align="left"
        appear={ORBIT.start - startFrame - 10}
      />
    </AbsoluteFill>
  );
};

const CompareCard: React.FC<{
  title: string;
  value: number;
  sub: string;
  highlight: boolean;
  delay: number;
}> = ({ title, value, sub, highlight, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 170 } });
  // Blink on/off ~3.75 Hz once both numbers are in
  const blink = highlight && frame > 24 ? (Math.floor((frame - 24) / 4) % 2 === 0 ? 1 : 0.25) : 0;
  return (
    <div
      style={{
        width: 400,
        padding: "34px 10px 30px",
        borderRadius: 40,
        background: highlight ? "rgba(60,38,6,0.75)" : "rgba(14,14,30,0.72)",
        border: `4px solid ${highlight ? YELLOW : "rgba(255,255,255,0.35)"}`,
        boxShadow: highlight
          ? `0 0 ${20 + blink * 70}px rgba(255,200,50,${0.25 + blink * 0.6})`
          : "0 20px 60px rgba(0,0,0,0.5)",
        textAlign: "center",
        fontFamily: FONT,
        color: "white",
        scale: interpolate(s, [0, 1], [0.4, 1]),
        opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
      }}
    >
      <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: 2 }}>{title}</div>
      <div
        style={{
          fontSize: 170,
          fontWeight: 900,
          lineHeight: 1.05,
          color: highlight ? YELLOW : "white",
          textShadow: highlight ? `0 0 ${10 + blink * 40}px rgba(255,200,50,0.9)` : textShadow,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 38, fontWeight: 700, opacity: 0.85 }}>dias</div>
      <div style={{ marginTop: 14, fontSize: 30, fontWeight: 700, opacity: 0.65 }}>{sub}</div>
    </div>
  );
};

export const SceneCompare: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = spring({ frame: frame - 14, fps, config: { damping: 10, stiffness: 200 } });
  const pulse = 1 + 0.12 * Math.max(0, Math.sin((frame - 24) * 0.8));
  return (
    <AbsoluteFill>
      <Headline text="Um *DIA* em Vênus dura mais que um *ANO* 🤯" fontSize={100} delay={10} />
      <AbsoluteFill
        style={{
          top: 760,
          height: 600,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        <CompareCard title="1 DIA" value={243} sub="1 giro" highlight delay={0} />
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
        <CompareCard title="1 ANO" value={225} sub="1 volta no Sol" highlight={false} delay={6} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const SceneRetro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 18, fps, config: { damping: 15, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <Headline text="E lá o Sol nasce no *OESTE*" fontSize={112} delay={6} />
      <div
        style={{
          position: "absolute",
          bottom: SAFE_Y + 50,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: s,
          translate: `0px ${interpolate(s, [0, 1], [60, 0])}px`,
        }}
      >
        <div
          style={{
            padding: "22px 44px",
            borderRadius: 999,
            background: "rgba(10,10,24,0.65)",
            border: `3px solid ${YELLOW}`,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 50,
            color: "white",
          }}
        >
          <span style={{ color: YELLOW }}>↻</span> gira ao contrário
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, config: { damping: 12, stiffness: 170 } });
  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(2,2,10,${interpolate(frame, [0, 10], [0, 0.35], clamp)})` }}>
      <Headline text={"Segue para mais *curiosidades*\u00A0🚀"} fontSize={104} center delay={2} />
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
