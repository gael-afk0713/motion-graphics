import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Captions, SceneCompare, SceneOrbit, SceneOutro, SceneSpin } from "./Overlays";
import { quickOut } from "./QuickOut";
import { SpaceScene } from "./SpaceScene";
import {
  CUT,
  NARRATION,
  SCENE_DURATIONS,
  SCENE_STARTS,
  trimFrames,
} from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// Fast transitions spanning [cut - 6, cut + 2]: the old text is gone by
// cut - 3, right when the new text pops in (3 frames ahead of the voice).
const T = 8;
const PRE = 6;

const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  const dim = interpolate(
    frame,
    [CUT.orbitEnd - 4, CUT.orbitEnd + 8, CUT.compareEnd - 4, CUT.compareEnd + 4],
    [0, 0.55, 0.55, 0],
    clamp,
  );
  const flash = Math.max(
    interpolate(frame, [CUT.approachEnd - 8, CUT.approachEnd - 6, CUT.approachEnd - 2], [0, 0.35, 0], clamp),
    interpolate(frame, [CUT.compareEnd - 8, CUT.compareEnd - 5, CUT.compareEnd - 1], [0, 0.6, 0], clamp),
    interpolate(frame, [CUT.retroEnd - 8, CUT.retroEnd - 6, CUT.retroEnd - 2], [0, 0.4, 0], clamp),
  );
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: "#02020a", opacity: dim }} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.65) 100%)",
        }}
      />
      <AbsoluteFill style={{ backgroundColor: "#fff3d0", opacity: flash }} />
    </>
  );
};

export const VenusVideo: React.FC = () => {
  const [d1, d2, d3, d4, d5, d6] = SCENE_DURATIONS;
  // Each scene sequence starts PRE frames before its cut (except the first)
  const seqStart = (i: number) => (i === 0 ? 0 : SCENE_STARTS[i] - PRE);
  return (
    <AbsoluteFill style={{ backgroundColor: "#02020a" }}>
      <SpaceScene />
      <Grade />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Intro" durationInFrames={d1 + T - PRE}>
          <AbsoluteFill />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={quickOut()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Rotação" durationInFrames={d2 + T}>
          <SceneSpin offset={seqStart(1)} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={quickOut()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Órbita" durationInFrames={d3 + T}>
          <SceneOrbit offset={seqStart(2)} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={quickOut()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Comparação" durationInFrames={d4 + T}>
          <SceneCompare offset={seqStart(3)} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={quickOut()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Retrógrado" durationInFrames={d5 + T}>
          <AbsoluteFill />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={quickOut()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="CTA" durationInFrames={d6 + PRE}>
          <SceneOutro offset={seqStart(5)} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      {/* Captions run on absolute video time, word by word with the voice */}
      <Captions />
      {/* Narration: one clip per scene, leading silence trimmed, ends at the cut */}
      {NARRATION.map((n, i) => (
        <Sequence
          key={n.file}
          name={`Narração ${i + 1}`}
          from={SCENE_STARTS[i]}
          durationInFrames={SCENE_DURATIONS[i]}
          layout="none"
        >
          <Audio
            src={staticFile(n.file)}
            trimBefore={trimFrames(i)}
            durationInFrames={SCENE_DURATIONS[i]}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
