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
  // the whole block appears at once (the first one is already on screen at frame 0)
  const enter = b.start === 0 ? 1 : spring({ frame: frame - b.start + 1, fps, config: { damping: 16, stiffness: 260, mass: 0.5 } });
  const lines = [...new Set(b.words.map((w) => w.line))];
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE_Y + 30,
        left: SIDE,
        right: SIDE,
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
        <div key={li} style={{ display: "flex", justifyContent: "center", alignItems: "baseline", columnGap: b.size * 0.34, whiteSpace: "nowrap" }}>
          {b.words
            .filter((w) => w.line === li)
            .map((w, i) => {
              // karaoke highlight while the word is being spoken
              const end = Math.max(w.endAt, w.spokenAt + 3);
              const on = interpolate(frame, [w.spokenAt - 2, w.spokenAt + 1, end - 1, end + 2], [0, 1, 1, 0], clamp);
              const base = w.key ? KEY : "#ffffff";
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    color: base,
                    transformOrigin: "50% 80%", // grow from the baseline: words stay aligned
                    scale: 1 + 0.08 * on,
                    filter: `brightness(${1 + 0.25 * on})`,
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

export const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  // scene 2: background darkens a little while we zoom into the eyes
  const dark = interpolate(frame, [S[1] + 6, sceneEnd(1) - 10, sceneEnd(1)], [0, 0.3, 0.3], clamp);
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
