// "Peixe-papagaio – parte 2/3": the sound-effect placements, as data only (no React / 3D), so the SFX
// sync check (scripts/sfx_cues.mjs + scripts/sfx_sync_check.py) can read them. f = the frame of the
// action in the picture; kitFx puts the effect's sync point (attack, or a whoosh's peak) on that frame.
// All effects come from the earshot kit (src/papagaio2/kit.ts), except goo (slime) and growl (belly),
// synthesised by scripts/papagaio2_synth.py because the bank has nothing good for them.
import { kitFx, type KitRole } from "./kit";
import {
  C1_RESULT,
  C2_CLOSED,
  C2_COVER,
  C2_HOUR,
  C2_LABEL,
  C2_SOLTA,
  C4_10,
  C4_25,
  C4_95,
  C4_BATTERY,
  C5_CHECK,
  C5_OUT,
  C6_GROWL,
  C7_A,
  C7_B,
  C8_PULSES,
  C8_Q,
  C_DAWN,
  C9_BOX,
  C9_TURNS,
  C9_TYPE,
  C9_TEXT,
  COUNT10_FRAMES,
  COUNT95_FRAMES,
  DURATION,
  FPS,
  HITS,
  S,
  WHIPS,
} from "./timeline";

export { DURATION, FPS };
export const SFX_DIR = "papagaio2/sfx";

export type Fx = { f: number; file: string; lead: number; durS: number; volume: number; role: string; align?: string };
const k = (role: KitRole, f: number, take = 0, gainDb = 0): Fx => kitFx(role, f, take, FPS, gainDb);
const synth = (file: string, f: number, durS: number, volume = 1, role = file): Fx => ({ f, file: `${file}.wav`, lead: 0, durS, volume, role, align: "onset" });

/** every frame where a counter changes its number (one tick each, at most one every 2 frames) */
const counterTicks = (from: number, frames: number, to: number) => {
  const out: number[] = [];
  let last = -1;
  let prevF = -99;
  for (let f = from; f <= from + frames; f++) {
    const p = Math.min(1, (f - from) / frames);
    const n = Math.round(to * (1 - (1 - p) * (1 - p)));
    if (n !== last && f - prevF >= 5) {
      out.push(f);
      prevF = f;
    }
    last = n;
  }
  return out;
};

export const FX: Fx[] = [
  // whoosh only on the 3 real changes of scene (with the whip); other cuts are silent
  ...WHIPS.map((f, i) => k("whoosh.short", f, i)),
  // scene 1: the result
  k("whoosh.long", C1_RESULT, 0),
  k("pop", C1_RESULT, 0),
  // scene 2: slime oozing and spreading, the clock, the label
  synth("goo", C2_SOLTA + 4, 2.6, 0.8),
  synth("goo", C2_COVER + 6, 2.6, 0.6),
  k("drip", C2_SOLTA + 6, 0),
  k("drip", C2_COVER + 10, 1),
  ...[0, 3, 6, 9, 12, 15].map((d, i) => k("tick", C2_HOUR + 2 + d, i, -4)),
  k("drip", C2_CLOSED, 2),
  k("whoosh.long", C2_LABEL, 1),
  k("pop", C2_LABEL, 1),
  // scene 3: each parasite bumps the bag
  ...HITS.map((f, i) => k("thud", f, i)),
  // scene 4: the counters tick, the battery beeps
  ...counterTicks(C4_95, COUNT95_FRAMES, 95).map((f, i) => k("tick", f, i)),
  k("pop", C4_95 + COUNT95_FRAMES, 2),
  ...counterTicks(C4_10, COUNT10_FRAMES, 10).map((f, i) => k("tick", f, i + 1)),
  k("pop", C4_10 + COUNT10_FRAMES, 3),
  k("pop", C4_BATTERY, 0, -3),
  k("beep", C4_25),
  // scene 5: right answer; the fish pushes out of the bag
  k("success", C5_CHECK),
  k("pop", C5_CHECK - 1, 2),
  synth("goo", C5_OUT + 6, 2.6, 0.5),
  k("drip", C5_OUT + 16, 3),
  // night -> dawn: soft flash, soft sound
  k("dawn", C_DAWN),
  // scene 6: the belly
  synth("growl", C6_GROWL, 1.15, 1),
  // scene 7: the cards
  k("whoosh.short", C7_A, 1),
  k("pop", C7_A, 1),
  k("whoosh.short", C7_B, 2),
  k("pop", C7_B, 2),
  // scene 8: COMENTA A OU B, the question mark
  k("pop", S[7] + 4, 3),
  k("tension", C8_Q, 0, -4),
  ...C8_PULSES.map((f, i) => k("beat", f, i)),
  // scene 9: tag a friend
  k("pop", C9_TEXT, 0),
  k("pop", C9_BOX, 1, -3),
  // the confused friend: a bloop at each turn
  ...C9_TURNS.map((f, i) => k("bubblepop", f, i)),
  k("key", C9_TYPE),
].filter((x) => x.f >= 0 && x.f < DURATION);
