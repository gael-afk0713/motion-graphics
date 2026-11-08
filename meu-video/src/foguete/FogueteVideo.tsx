import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { BOUNDARIES, CameraLayer, Captions, Grade } from "./Overlays";
import { FogueteScene } from "./Scene3D";
import { IMPACT, S, SCENE_DURATIONS, SCENES } from "./timeline";

// whoosh.wav peaks ~0.35 s in: start it so the peak lands on the cut
const WHOOSH_LEAD = 10;

export const FogueteVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <CameraLayer>
      <FogueteScene />
    </CameraLayer>
    <Grade />
    <Captions />
    {/* narration exactly as delivered: no speed change, no trimming */}
    {SCENES.map((s, i) => (
      <Sequence
        key={s.file}
        name={`Narração ${i + 1}`}
        from={S[i]}
        durationInFrames={SCENE_DURATIONS[i]}
        layout="none"
      >
        <Audio src={staticFile(s.file)} />
      </Sequence>
    ))}
    {/* sound effects (generated with ffmpeg, ~18 dB below the voice) */}
    {BOUNDARIES.map((b, i) => (
      <Sequence
        key={`w${i}`}
        name={`Whoosh ${i + 1}`}
        from={b - WHOOSH_LEAD}
        durationInFrames={21}
        layout="none"
      >
        <Audio src={staticFile("foguete/sfx/whoosh.wav")} />
      </Sequence>
    ))}
    <Sequence name="Boom" from={IMPACT - 1} durationInFrames={96} layout="none">
      <Audio src={staticFile("foguete/sfx/boom.wav")} />
    </Sequence>
  </AbsoluteFill>
);
