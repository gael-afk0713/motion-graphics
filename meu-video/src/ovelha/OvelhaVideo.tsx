import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Captions, Grade } from "./Overlays";
import { OvelhaScene } from "./Scene3D";
import { S, SCENE_DURATIONS, SCENES } from "./timeline";

export const OvelhaVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#2a7f8c" }}>
    <OvelhaScene />
    <Grade />
    <Captions />
    {/* narration exactly as delivered: no speed change, no trimming */}
    {SCENES.map((s, i) => (
      <Sequence key={s.file} name={`Narração ${i + 1}`} from={S[i]} durationInFrames={SCENE_DURATIONS[i]} layout="none">
        <Audio src={staticFile(s.file)} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
