import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  SceneCompare,
  SceneIntro,
  SceneOrbit,
  SceneOutro,
  SceneRetro,
  SceneSpin,
} from "./Overlays";
import { SpaceScene } from "./SpaceScene";
import { CUT } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const T = 8; // fast transitions, centred on each cut

const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  const dim = interpolate(
    frame,
    [CUT.orbitEnd - 4, CUT.orbitEnd + 8, CUT.compareEnd - 4, CUT.compareEnd + 4],
    [0, 0.55, 0.55, 0],
    clamp,
  );
  const flash = Math.max(
    interpolate(frame, [CUT.approachEnd - 3, CUT.approachEnd, CUT.approachEnd + 6], [0, 0.35, 0], clamp),
    interpolate(frame, [CUT.compareEnd - 2, CUT.compareEnd + 1, CUT.compareEnd + 9], [0, 0.6, 0], clamp),
    interpolate(frame, [CUT.retroEnd - 2, CUT.retroEnd + 1, CUT.retroEnd + 8], [0, 0.4, 0], clamp),
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
  const { fps } = useVideoConfig();
  // Sequence starts (absolute) so scenes can sync with the 3D timeline
  const s2 = 2 * fps - T / 2;
  const s3 = 6 * fps - T / 2;
  return (
    <AbsoluteFill style={{ backgroundColor: "#02020a" }}>
      <SpaceScene />
      <Grade />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Intro" durationInFrames={2 * fps + T / 2}>
          <SceneIntro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Rotação" durationInFrames={4 * fps + T}>
          <SceneSpin startFrame={s2} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence name="Órbita" durationInFrames={4 * fps + T}>
          <SceneOrbit startFrame={s3} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Comparação" durationInFrames={3 * fps + T}>
          <SceneCompare />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Retrógrado" durationInFrames={2 * fps + T}>
          <SceneRetro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="CTA" durationInFrames={1 * fps + T / 2}>
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
