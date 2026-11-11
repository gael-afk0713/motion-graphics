import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FONT } from "../venus/Overlays";
import { ACTIONS, DURATION, FPS, FX, SFX_DIR } from "./sfx";

const COLORS = ["#0b84ad", "#e85d75", "#f2a541", "#3a9d5d", "#6c5ce7", "#d35400", "#1abc9c", "#c0392b", "#2c3e50", "#8e44ad", "#16a085", "#f39c12", "#27ae60", "#2980b9", "#e74c3c", "#34495e"];

const SfxTrack: React.FC = () => (
  <>
    {FX.map((x, i) => {
      const from = Math.max(0, x.f - x.lead);
      return (
        <Sequence key={i} name={`SFX ${x.role}`} from={from} durationInFrames={Math.min(Math.ceil(x.durS * FPS) + 1, DURATION - from)} layout="none">
          <Audio src={staticFile(`${SFX_DIR}/${x.file}`)} volume={x.volume} />
        </Sequence>
      );
    })}
  </>
);

/** the effects alone, for the sync check */
export const SfxDemoStem: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <SfxTrack />
  </AbsoluteFill>
);

export const SfxDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const k = ACTIONS.filter((a) => a <= frame).length;
  const last = k ? ACTIONS[k - 1] : 0;
  const role = FX.filter((x) => x.f === last).map((x) => x.role).join(" + ");
  const flash = k && frame - last < 3 ? 1 - (frame - last) / 3 : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS[k % COLORS.length] }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT, fontWeight: 900, fontSize: 110, color: "#fff" }}>
        {k ? role.toUpperCase() : "SFX TEST"}
        <div style={{ fontSize: 60 }}>frame {last}</div>
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: `rgba(255,255,255,${0.8 * flash})` }} />}
      {/* a voice under the effects, as in a real video */}
      <Audio src={staticFile("papagaio/papagaio5.mp3")} />
      <SfxTrack />
    </AbsoluteFill>
  );
};
