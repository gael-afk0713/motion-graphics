import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Badge, CameraLayer, Captions, Choice, Grade, Scene5Overlays, ToolLabels } from "./Overlays";
import { PapagaioScene, WarnCanvas } from "./Scene3D";
import { FX, LEN, SFX_DIR } from "./sfx";
import { DURATION, FPS, S, SCENE_DURATIONS } from "./timeline";
import { NARRATION } from "./words";

/** the sound effects on their own (no picture, voice or ambience), placed exactly as in the
 *  video: rendered as an audio stem for the SFX sync check (composition Papagaio1Sfx) */
const SfxTrack: React.FC = () => (
  <>
    {FX.map((x, i) => {
      const from = Math.max(0, x.f - (x.lead ?? 0));
      const dur = Math.min(Math.ceil(LEN[x.file] * FPS) + 1, DURATION - from);
      if (dur <= 0) return null;
      return (
        <Sequence key={i} name={`SFX ${x.file}`} from={from} durationInFrames={dur} layout="none">
          <Audio src={staticFile(`${SFX_DIR}/${x.file}.wav`)} volume={x.volume ?? 1} />
        </Sequence>
      );
    })}
  </>
);

export const PapagaioSfxStem: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <SfxTrack />
  </AbsoluteFill>
);

export const PapagaioVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0b84ad" }}>
    <CameraLayer>
      <PapagaioScene />
    </CameraLayer>
    <Grade />
    <Choice />
    <WarnCanvas />
    <Scene5Overlays />
    <ToolLabels />
    <Captions />
    <Badge />
    {/* narration: one file per scene, back to back, never overlapping */}
    {NARRATION.map((n, i) => (
      <Sequence key={n.file} name={`Narração ${i + 1}`} from={S[i]} durationInFrames={SCENE_DURATIONS[i]} layout="none">
        <Audio src={staticFile(n.file)} />
      </Sequence>
    ))}
    {/* underwater bed for the whole video, far below the voice */}
    <Sequence name="Ambiente submarino" durationInFrames={DURATION} layout="none">
      <Audio src={staticFile("papagaio/sfx/ambience.wav")} />
    </Sequence>
    <SfxTrack />
  </AbsoluteFill>
);
