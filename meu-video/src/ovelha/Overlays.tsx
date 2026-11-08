import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, SAFE_Y } from "../venus/Overlays";
import { BLOCKS } from "./captions";
import { S, sceneEnd } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const KEY = "#FFD23F";
const SIDE = 80;
// dark outline (8 directions) + soft drop shadow -> readable on any background
const O = 5;
const outline = [
  [O, 0], [-O, 0], [0, O], [0, -O], [O * 0.7, O * 0.7], [-O * 0.7, O * 0.7], [O * 0.7, -O * 0.7], [-O * 0.7, -O * 0.7],
].map(([x, y]) => `${x}px ${y}px 0 #0b1c22`).join(", ") + ", 0 10px 26px rgba(0,0,0,0.55)";

const Block: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = BLOCKS[index];
  const next = index + 1 < BLOCKS.length ? BLOCKS[index + 1].start : Infinity;
  if (frame < b.start || frame >= next) return null;
  const out = Number.isFinite(next) ? interpolate(frame, [next - 3, next], [1, 0], clamp) : 1;
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
        fontSize: b.size,
        lineHeight: 1.1,
        textAlign: "center",
        letterSpacing: -1,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: b.size * 0.26,
      }}
    >
      {b.words.map((w, i) => {
        const s =
          frame < w.appearAt
            ? 0
            : w.appearAt === 0
              ? 1 // the first line is fully on screen from frame 0
              : spring({ frame: frame - w.appearAt + 1, fps, config: { damping: 14, stiffness: 200, mass: 0.5 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: w.key ? KEY : "#ffffff",
              opacity: interpolate(s, [0, 0.3], [0, 1], clamp),
              scale: interpolate(s, [0, 1], [w.key ? 1.2 : 0.75, 1]),
              translate: `0px ${interpolate(s, [0, 1], [24, 0])}px`,
              textShadow: outline,
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
    {BLOCKS.map((_, i) => (
      <Block key={i} index={i} />
    ))}
  </AbsoluteFill>
);

export const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  // scene 2: background darkens a little while we zoom into the eyes
  const dark = interpolate(frame, [S[1] + 6, sceneEnd(1) - 10, sceneEnd(1)], [0, 0.42, 0.42], clamp);
  // quick dips in water colour hide the set changes (leaf <-> sand)
  const dip = Math.max(
    interpolate(frame, [S[2] - 6, S[2] - 1, S[2] + 1, S[2] + 7], [0, 1, 1, 0], clamp),
    interpolate(frame, [S[3] - 6, S[3] - 1, S[3] + 1, S[3] + 7], [0, 1, 1, 0], clamp),
  );
  return (
    <>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) ${45 - dark * 30}%, rgba(4,20,24,${0.45 + dark}) 100%)` }} />
      <AbsoluteFill style={{ backgroundColor: "#2a7f8c", opacity: dip }} />
    </>
  );
};
