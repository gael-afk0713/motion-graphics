import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Badge, Battery, CallToAction, CameraLayer, Captions, Check, Foreground, Grade, Labels, Vote, YouArrow } from "./Overlays";
import { Papagaio3Scene } from "./Scene3D";
import { FX, SFX_DIR } from "./sfx";
import { DURATION, FPS, S, SCENE_DURATIONS } from "./timeline";
import { NARRATION } from "./words";
import { DUCK } from "./duck";

/** sidechain: effects and bed 7 dB down while the voice speaks (absolute frame of the video) */
const duck = (abs: number) => DUCK[Math.max(0, Math.min(DUCK.length - 1, abs))] ?? 1;

/** the sound effects on their own, placed exactly as in the video (composition Papagaio3Sfx, for the sync check) */
const SfxTrack: React.FC = () => (
  <>
    {FX.map((x, i) => {
      const from = Math.max(0, x.f - x.lead);
      const dur = Math.min(Math.ceil(x.durS * FPS) + 1, DURATION - from);
      if (dur <= 0) return null;
      return (
        <Sequence key={i} name={`SFX ${x.role}`} from={from} durationInFrames={dur} layout="none">
          <Audio src={staticFile(`${SFX_DIR}/${x.file}`)} volume={(fr) => x.volume * duck(from + fr)} />
        </Sequence>
      );
    })}
  </>
);

export const Papagaio3SfxStem: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <SfxTrack />
  </AbsoluteFill>
);

export const Papagaio3Video: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0b84ad" }}>
    <CameraLayer>
      <Papagaio3Scene />
      <Foreground />
    </CameraLayer>
    <Grade />
    <Vote />
    <Battery />
    <Check />
    <YouArrow />
    <Labels />
    <CallToAction />
    <Captions />
    <Badge />
    {/* narration: one file per scene, back to back, never overlapping */}
    {NARRATION.map((n, i) => (
      <Sequence key={n.file} name={`Narração ${i + 1}`} from={S[i]} durationInFrames={SCENE_DURATIONS[i]} layout="none">
        <Audio src={staticFile(n.file)} />
      </Sequence>
    ))}
    {/* continuous underwater bed, its timbre changing per scene, ~30 dB under the voice, ducked under it */}
    <Sequence name="Ambiente submarino" durationInFrames={DURATION} layout="none">
      <Audio src={staticFile(`${SFX_DIR}/bed.wav`)} volume={(fr) => duck(fr)} />
    </Sequence>
    <SfxTrack />
  </AbsoluteFill>
);
