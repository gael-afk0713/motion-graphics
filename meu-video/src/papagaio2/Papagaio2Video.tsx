import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Badge, Battery, CameraLayer, Captions, Check, Choice, Clock, Grade, Split, TagFriend, ToolLabels, VoteResult } from "./Overlays";
import { FriendCanvas, Papagaio2Scene } from "./Scene3D";
import { FX, SFX_DIR } from "./sfx";
import { C9_TURNS, DURATION, FPS, S, SCENE_DURATIONS } from "./timeline";
import { NARRATION } from "./words";

/** the sound effects on their own, placed exactly as in the video (composition Papagaio2Sfx, for the sync check) */
const SfxTrack: React.FC = () => (
  <>
    {FX.map((x, i) => {
      const from = Math.max(0, x.f - x.lead);
      const dur = Math.min(Math.ceil(x.durS * FPS) + 1, DURATION - from);
      if (dur <= 0) return null;
      return (
        <Sequence key={i} name={`SFX ${x.role}`} from={from} durationInFrames={dur} layout="none">
          <Audio src={staticFile(`${SFX_DIR}/${x.file}`)} volume={x.volume} />
        </Sequence>
      );
    })}
  </>
);

export const Papagaio2SfxStem: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <SfxTrack />
  </AbsoluteFill>
);

export const Papagaio2Video: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0b84ad" }}>
    <CameraLayer>
      <Papagaio2Scene />
      <Split />
    </CameraLayer>
    <Grade />
    <VoteResult />
    <Choice />
    <FriendCanvas turns={C9_TURNS} />
    <TagFriend />
    <Clock />
    <Battery />
    <Check />
    <ToolLabels />
    <Captions />
    <Badge />
    {/* narration: one file per scene, back to back, never overlapping */}
    {NARRATION.map((n, i) => (
      <Sequence key={n.file} name={`Narração ${i + 1}`} from={S[i]} durationInFrames={SCENE_DURATIONS[i]} layout="none">
        <Audio src={staticFile(n.file)} />
      </Sequence>
    ))}
    {/* underwater bed for the whole video, far below the voice (the parte 1 bed) */}
    <Sequence name="Ambiente submarino" durationInFrames={DURATION} layout="none">
      <Audio src={staticFile(`${SFX_DIR}/ambience.wav`)} />
    </Sequence>
    <SfxTrack />
  </AbsoluteFill>
);
