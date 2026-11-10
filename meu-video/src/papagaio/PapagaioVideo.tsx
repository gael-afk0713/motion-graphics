import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Badge, CameraLayer, Captions, Choice, COUNT_FRAMES, Grade, Scene5Overlays, ToolLabels } from "./Overlays";
import { BITES, PapagaioScene, PECKS, WarnCanvas } from "./Scene3D";
import {
  C1_ISLAND,
  C2_BITE,
  C2_GROW,
  C3_CLANK,
  C3_STONE,
  C4_GRIND,
  C4_LABEL,
  C4_MILL,
  C5_AERIAL,
  C5_COUNT,
  C5_LABEL,
  C5_PIN,
  C5_SCHOOL,
  C6_AROUND,
  C6_DROP,
  C6_SWARM,
  C7_NIGHT,
  C8_A,
  C8_B,
  C9_WARN,
  DURATION,
  FPS,
  S,
  SCENE_DURATIONS,
  WHIPS,
} from "./timeline";
import { NARRATION } from "./words";

// sound effects: all synthesised by scripts/papagaio_sfx.py (levels baked into the files)
type Fx = { f: number; file: string; volume?: number; lead?: number };
const WHOOSH_LEAD = 9; // whoosh.wav peaks 0.3 s in
const FX: Fx[] = [
  { f: 0, file: "bubbles", volume: 0.8 },
  ...WHIPS.map((f) => ({ f, file: "whoosh", lead: WHOOSH_LEAD })),
  { f: C1_ISLAND, file: "splash" },
  { f: C1_ISLAND + 6, file: "waves", volume: 0.8 },
  { f: C2_GROW + 3, file: "whoosh", lead: WHOOSH_LEAD, volume: 0.6 },
  { f: C2_BITE, file: "crack" },
  { f: C2_BITE, file: "whoosh", lead: WHOOSH_LEAD, volume: 0.7 },
  { f: C2_BITE + 1, file: "pop" },
  ...BITES.filter((b) => S[2] + b < C3_STONE).map((b) => ({ f: S[2] + b, file: "bite" })),
  { f: C3_CLANK, file: "clank" },
  { f: C4_MILL, file: "grind", volume: 0.45 },
  { f: C4_GRIND, file: "grind" },
  { f: C4_GRIND + 60, file: "grind", volume: 0.6 },
  { f: C4_LABEL, file: "whoosh", lead: WHOOSH_LEAD, volume: 0.7 },
  { f: C4_LABEL + 1, file: "pop" },
  { f: S[4], file: "bubbles" },
  { f: C5_PIN, file: "pop" },
  ...Array.from({ length: Math.floor(COUNT_FRAMES / 3) + 1 }, (_, i) => ({ f: C5_COUNT + i * 3, file: "tick" })),
  { f: C5_COUNT + COUNT_FRAMES, file: "pop" },
  { f: C5_SCHOOL, file: "bubbles", volume: 0.8 },
  { f: C5_AERIAL, file: "waves" },
  { f: C5_AERIAL + 110, file: "waves", volume: 0.8 },
  { f: C5_LABEL, file: "whoosh", lead: WHOOSH_LEAD, volume: 0.7 },
  { f: C5_LABEL + 1, file: "pop" },
  { f: S[5], file: "drone" },
  { f: C6_SWARM, file: "swarm" },
  { f: C6_DROP, file: "drip" },
  { f: C6_AROUND, file: "swarm" },
  ...PECKS.filter((p) => S[6] + p < C7_NIGHT).map((p) => ({ f: S[6] + p, file: "drip", volume: 0.6 })),
  { f: C7_NIGHT, file: "drone", volume: 0.7 },
  { f: C7_NIGHT + 8, file: "bubbles", volume: 0.6 },
  { f: C7_NIGHT + 14, file: "swarm", volume: 0.8 },
  { f: S[7], file: "drone", volume: 0.6 },
  { f: C8_A, file: "whoosh", lead: WHOOSH_LEAD },
  { f: C8_A + 1, file: "pop" },
  { f: C8_B, file: "whoosh", lead: WHOOSH_LEAD },
  { f: C8_B + 1, file: "pop" },
  { f: S[8] + 5, file: "pop" },
  { f: C9_WARN, file: "swarm", volume: 1.4 },
  { f: C9_WARN + 4, file: "whoosh", lead: WHOOSH_LEAD },
];
const LEN: Record<string, number> = { ambience: 62, whoosh: 0.6, crack: 0.45, bite: 0.22, clank: 0.7, grind: 2.6, tick: 0.035, bubbles: 1.6, splash: 1.3, waves: 4.2, drone: 5.4, swarm: 2.4, drip: 0.14, pop: 0.16 };

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
    {FX.map((x, i) => {
      const from = Math.max(0, x.f - (x.lead ?? 0));
      const dur = Math.min(Math.ceil(LEN[x.file] * FPS) + 1, DURATION - from);
      if (dur <= 0) return null;
      return (
        <Sequence key={i} name={`SFX ${x.file}`} from={from} durationInFrames={dur} layout="none">
          <Audio src={staticFile(`papagaio/sfx/${x.file}.wav`)} volume={x.volume ?? 1} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
