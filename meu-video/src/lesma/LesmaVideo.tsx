import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Captions, Grade, MonthsCounter, QuestionMark } from "./Overlays";
import { LesmaScene } from "./Scene3D";
import { NARRATION, SCENE_DURATIONS, SCENE_STARTS } from "./timeline";

export const LesmaVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#03182b" }}>
      <LesmaScene />
      <Grade />
      <MonthsCounter />
      <QuestionMark />
      <Captions />
      {/* Narration as delivered: no speed change, no trimming */}
      {NARRATION.map((n, i) => (
        <Sequence key={n.file} name={`Narração ${i + 1}`} from={SCENE_STARTS[i]} durationInFrames={SCENE_DURATIONS[i]} layout="none">
          <Audio src={staticFile(n.file)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
