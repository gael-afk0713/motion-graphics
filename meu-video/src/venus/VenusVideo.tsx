import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  SceneCompare,
  SceneIntro,
  SceneOrbit,
  SceneOutro,
  SceneRetro,
  SceneSpin,
} from "./Overlays";
import { SpaceScene } from "./SpaceScene";
import { CUT, NARRATION, SCENE_DURATIONS, SCENE_STARTS } from "./timeline";

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
  const [d1, d2, d3, d4, d5, d6] = SCENE_DURATIONS;
  // Each text sequence starts T/2 before its cut (except the first),
  // so the speech starts at local frame T/2.
  const seqStart = (i: number) => (i === 0 ? 0 : SCENE_STARTS[i] - T / 2);
  const speechAt = (i: number) => SCENE_STARTS[i] - seqStart(i);
  return (
    <AbsoluteFill style={{ backgroundColor: "#02020a" }}>
      <SpaceScene />
      <Grade />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Intro" durationInFrames={d1 + T / 2}>
          <SceneIntro speechAt={speechAt(0)} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Rotação" durationInFrames={d2 + T}>
          <SceneSpin startFrame={seqStart(1)} speechAt={speechAt(1)} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence name="Órbita" durationInFrames={d3 + T}>
          <SceneOrbit startFrame={seqStart(2)} speechAt={speechAt(2)} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Comparação" durationInFrames={d4 + T}>
          <SceneCompare speechAt={speechAt(3)} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="Retrógrado" durationInFrames={d5 + T}>
          <SceneRetro speechAt={speechAt(4)} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="CTA" durationInFrames={d6 + T / 2}>
          <SceneOutro speechAt={speechAt(5)} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
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
            trimBefore={Math.floor(n.start * fps)}
            durationInFrames={SCENE_DURATIONS[i]}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
