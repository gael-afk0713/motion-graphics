// "Peixe-papagaio": the sound-effect placements, as data only (no React / 3D), so the
// SFX sync check (scripts/sfx_cues.mjs + scripts/sfx_sync_check.py) can read them.
// f = the frame of the action in the picture; lead = frames the file starts before it
// (a whoosh peaks 0.3 s into its file, so the peak lands on the cut).
import {
  BITES,
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
  COUNT_FRAMES,
  FPS,
  PECKS,
  S,
  WHIPS,
} from "./timeline";

export { FPS };

/** where the effect files live under public/ (file = name without .wav) */
export const SFX_DIR = "papagaio/sfx";

// sound effects: all synthesised by scripts/papagaio_sfx.py (levels baked into the files)
export type Fx = { f: number; file: string; volume?: number; lead?: number };
export const WHOOSH_LEAD = 9; // whoosh.wav peaks 0.3 s in
export const FX: Fx[] = [
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
export const LEN: Record<string, number> = { ambience: 62, whoosh: 0.6, crack: 0.45, bite: 0.22, clank: 0.7, grind: 2.6, tick: 0.035, bubbles: 1.6, splash: 1.3, waves: 4.2, drone: 5.4, swarm: 2.4, drip: 0.14, pop: 0.16 };

