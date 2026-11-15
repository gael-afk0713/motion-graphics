// "Peixe-papagaio – parte 3/3": the sound-effect placements, as data only (no React / 3D), so the SFX
// sync check (scripts/sfx_cues.mjs + scripts/sfx_sync_check.py) can read them. f = the frame of the
// action in the picture; kitFx puts the effect's sync point (attack, or a sweep's peak) on that frame.
//
// Sound-design review of v5:
// * every effect is placed RELATIVE TO THE VOICE: `rel` is its peak in dB against the voice peak of its scene
//   (VOICE_PEAK, measured by scripts/papagaio3_levels.py): label / card pops -12, bites -11, transitions -10,
//   action sounds -10 to -12; nothing above -6 dB relative to the voice;
// * every file is the 5 kHz low-passed copy (public/papagaio3/sfx/lp, scripts/papagaio3_sound.py); the bites
//   use the muffled 2.5 kHz version;
// * pops are soft bubble pops; transitions are a soft 0.3 s filter sweep, only 3 in the video;
// * the effects and the bed are ducked 7 dB under the voice (src/papagaio3/duck.ts) in the video.
// Sources: the earshot kit (src/papagaio3/kit.ts) for pops, bites, shimmer, tension, thud, beep; synthesised
// (no match in the bank): the sweep, the current (low flow of water) and the sand.
import { kitFx, type KitRole } from "./kit";
import {
  BITES,
  BUBBLE_COUNT,
  BUBBLE_GAP,
  C1_GONE,
  C1_SEXO,
  C2_BAD,
  C2_BUBBLES,
  C2_VOTE,
  C3_BATTERY,
  C3_NADA,
  C3_WEAK,
  C3_WORST,
  C4_INSIST,
  C4_PUSH,
  C5_CHECK,
  C6_ARROW,
  C6_COLORS,
  C7_KILOS,
  C7_LAPSE,
  C7_PILE,
  C7_SAND,
  C7_TONS,
  C8_ASK,
  C8_COMENTA,
  C8_FEMEA,
  C8_ILHA,
  C8_MACHO,
  DURATION,
  FPS,
  S,
  sceneOf,
  WHIPS,
} from "./timeline";

export { DURATION, FPS };
export const SFX_DIR = "papagaio3/sfx";

export type Fx = { f: number; file: string; lead: number; durS: number; volume: number; role: string; align?: string };

/** peak of the narration per scene, dBFS (scripts/papagaio3_levels.py, 100 ms windows) */
const VOICE_PEAK = [-16.3, -11.1, -12.8, -13.3, -13.9, -13.6, -15.9, -14.1];
/** peak of each kit role's file at gain 0 (kit level included, after the 5 kHz low-pass), dBFS */
const NATIVE: Partial<Record<KitRole, number>> = { bubblepop: -7, crack: -6, dawn: -11, tension: -7, thud: -7, beep: -9 };
const lpFile = (file: string, muffled = false) => `lp/${muffled ? file.replace(".wav", "_m.wav") : file}`;

/** a kit effect whose peak sits `rel` dB under the voice peak of the scene it plays in */
const k = (role: KitRole, f: number, take: number, rel: number, muffled = false): Fx => {
  const x = kitFx(role, f, take, FPS, VOICE_PEAK[sceneOf(f)] + rel - (NATIVE[role] ?? -7));
  return { ...x, file: lpFile(x.file, muffled) };
};
/** the same effect started one frame earlier (the action frame stays the same) */
const early = (x: Fx): Fx => ({ ...x, lead: x.lead + 1 });
/** a synthesised effect (peak of the file given) placed the same way */
const synth = (file: string, f: number, durS: number, filePeakDb: number, rel: number, role = file): Fx => ({
  f,
  file: lpFile(`${file}.wav`),
  lead: 0,
  durS,
  volume: Math.min(1, 10 ** ((VOICE_PEAK[sceneOf(f)] + rel - filePeakDb) / 20)),
  role,
  align: "onset",
});
/** the transition: a soft filter sweep whose peak (0.22 s in) lands on the cut */
const sweep = (f: number, rel = -10): Fx => ({
  f,
  file: lpFile("sweep.wav"),
  lead: Math.round(0.22 * FPS),
  durS: 0.36,
  volume: Math.min(1, 10 ** ((VOICE_PEAK[sceneOf(f)] + rel + 6) / 20)),
  role: "sweep",
  align: "peak",
});

export const FX: Fx[] = [
  // the 3 transitions (lagoon -> hunger, -> the crossing, -> the outer reef)
  ...WHIPS.map((f, i) => sweep(f, i === 2 ? -13 : -10)), // the 3rd one starts on the quiet end of "Você insiste"
  // scene 1: MUDA DE SEXO; the old male dissolves (a soft sparkle)
  k("bubblepop", C1_SEXO, 0, -12),
  early(k("dawn", C1_GONE, 0, -12)), // starts 1 frame earlier: its measured sync point lands +37 ms late otherwise
  // scene 2: the comment bubbles, VOCÊS VOTARAM: B, PÉSSIMA IDEIA (+ a low swell)
  ...Array.from({ length: BUBBLE_COUNT }, (_, i) => k("bubblepop", C2_BUBBLES + i * BUBBLE_GAP, i, -15)),
  k("bubblepop", C2_VOTE, 1, -12),
  k("bubblepop", C2_BAD, 2, -12),
  k("tension", C2_BAD, 0, -12),
  // scene 3: the energy bar; 3 dry, muffled "tec" on the bites; "Nada" (dry); weak; "Mas o pior" (short low swell)
  k("bubblepop", C3_BATTERY, 3, -14),
  ...BITES.map((f, i) => k("crack", f, i, -11, true)),
  k("thud", C3_NADA, 0, -12),
  k("beep", C3_WEAK, 0, -14),
  k("tension", C3_WORST, 0, -10),
  // scene 4: a continuous, low flow of water when the current pushes the fish back (the bed moves too)
  synth("current", C4_PUSH, 2.4, -6, -12),
  synth("current", C4_INSIST, 2.4, -6, -16),
  // scene 5: right answer (small check). The 0.3 s before "e o macho…" is silent (no effect, bed muted)
  k("bubblepop", C5_CHECK, 0, -12),
  // scene 6: the arrow; the colour change (a subtle rising shimmer)
  k("bubblepop", C6_ARROW, 1, -12),
  early(k("dawn", C6_COLORS, 0, -10)), // same
  // scene 7: biting live coral (muffled "tec"), the soft grainy sand, the labels
  ...[6, 20, 34].map((d, i) => k("crack", S[6] + d, i, -12, true)),
  synth("sand", C7_SAND + 2, 2.2, -12, -10),
  synth("sand", C7_PILE + 2, 2.2, -12, -12),
  k("bubblepop", C7_KILOS, 2, -12),
  k("bubblepop", C7_TONS, 3, -12),
  synth("sand", C7_LAPSE, 2.2, -12, -12),
  // scene 8: FÊMEA, MACHO, ILHA, QUAL ANIMAL?, COMENTA
  k("bubblepop", C8_FEMEA, 0, -12),
  k("bubblepop", C8_MACHO, 1, -12),
  k("bubblepop", C8_ILHA, 2, -12),
  k("bubblepop", C8_ASK, 3, -12),
  k("bubblepop", C8_COMENTA, 0, -12),
].filter((x) => x.f >= 0 && x.f < DURATION);
