// "Peixe-papagaio – parte 3/3": the timeline. Every scene lasts exactly its narration file (+4 frames,
// durations from ffprobe); every cue below is taken from a spoken word (src/papagaio3/words.ts, generated
// by scripts/papagaio3_words.py from the audio with faster-whisper). Everything else (3D, overlays, sfx)
// reads from here.
import { NARRATION } from "./words";

export const FPS = 30;
export const TAIL_FRAMES = 4;

// the last scene holds the call to action 1.5 s longer before the ending, so COMENTA and the promise can be read
export const CTA_HOLD = 45;
export const SCENE_DURATIONS = NARRATION.map((n, i) => Math.ceil(n.dur * FPS) + TAIL_FRAMES + (i === NARRATION.length - 1 ? CTA_HOLD : 0));
export const S = SCENE_DURATIONS.map((_, i) => SCENE_DURATIONS.slice(0, i).reduce((a, b) => a + b, 0));
export const DURATION = SCENE_DURATIONS.reduce((a, b) => a + b, 0);
export const sceneEnd = (i: number) => S[i] + SCENE_DURATIONS[i];
export const at = (i: number, sec: number) => S[i] + Math.round(sec * FPS);
export const sceneOf = (f: number) => {
  for (let i = S.length - 1; i >= 0; i--) if (f >= S[i]) return i;
  return 0;
};
/** start (absolute frame) of the n-th caption word of scene i (0-based) */
export const word = (i: number, n: number) => at(i, NARRATION[i].t[n]);

// ---------------------------------------------------------------------------
// Cues (absolute frames)
// ---------------------------------------------------------------------------
// scene 1: the hook (works on its own, no recap)
export const C1_SEXO = word(0, 2); // "muda de sexo": giant label + short zoom shake
export const C1_CHEFE = word(0, 7) - 2; // "chefe do grupo": the group swims in, the big colourful male in the middle
export const C1_GONE = word(0, 10); // "desaparece": the male dissolves into sparkles
// scene 2: the vote (the lagoon)
export const BUBBLE_COUNT = 6;
export const BUBBLE_GAP = 4;
export const C2_BUBBLES = S[1] + 2; // comment bubbles with a yellow "B" rise
export const C2_VOTE = word(1, 1); // "votaram": VOCÊS VOTARAM: B
export const C2_BAD = word(1, 5); // "Péssima ideia": the lagoon cools down, PÉSSIMA IDEIA in red
// scene 3: hunger
export const C3_BATTERY = S[2] + 6; // the energy bar shows up (full) and drains with the narration
export const C3_BITE = word(2, 8) - 2; // "Seu bico morde pedra morta": side close-up of the beak on dead rock
export const BITES = [10, 11, 12].map((n) => word(2, n)); // 3 bites, the beak closes on "morde / pedra / morta"
export const C3_NADA = word(2, 13); // "Nada": short visual pause, dry sound
export const C3_HOURS = word(2, 14) - 2; // "Você está há horas": wide side shot, slower
export const C3_WEAK = word(2, 23); // "mais fraco": the bar turns red
export const C3_WORST = word(2, 25); // "Mas o pior": quick zoom + short low tension sound (no whoosh)
// scene 4: the crossing
export const C4_REEF = word(3, 7); // "recife de fora": the breaking waves ahead
export const C4_PUSH = word(3, 16); // "empurra você de volta": pushed back by the current
export const C4_INSIST = word(3, 20); // "Você insiste": forward again, crosses the line of the waves
// scene 5: arrival at the outer reef
export const C5_CHECK = word(4, 3); // "acertou": small green check
export const C5_ARRIVE = word(4, 4) - 2; // "Você chega"
export const C5_GROUP = word(4, 8) - 2; // "o macho que mandava aqui": the females without direction, an empty spot
export const C5_HUSH = word(4, 6) + 11; // the real pause of the voice ends at ~28.37 s // "e o macho…": 0.3 s of silence (bed and effects) right before this line
// scene 6: the change
export const C6_ARROW = word(5, 13); // "E a maior… é você": small yellow arrow
export const C6_COLORS = word(5, 18); // "As cores mudam": colour wave head -> tail
export const COLOR_FRAMES = 40;
export const C6_LEAD = word(5, 21) - 2; // "Você assume o grupo": the females follow, orbit up
// scene 7: sand
export const C7_SAND = word(6, 4) - 2; // "vira areia": the cloud of sand behind the fish
export const C7_PILE = word(6, 8) - 2; // "solta dezenas": sand falling and piling up
export const C7_KILOS = word(6, 9); // DEZENAS DE QUILOS
export const C7_LAPSE = word(6, 14) - 2; // "O gigante": time-lapse, the beach grows
export const C7_TONS = word(6, 16); // TONELADAS (time-lapse speeds up)
// scene 8: ending + call to action
export const C8_FEMEA = word(7, 2); // "fêmea"
export const C8_MACHO = word(7, 4); // "macho"
export const C8_BUILD = word(7, 7); // "construiu uma ilha": the camera starts zooming into the island
export const C8_ILHA = word(7, 9); // "ilha"
export const C8_ASK = word(7, 10); // "Qual animal você quer ser na próxima série?": QUAL ANIMAL?
export const C8_COMENTA = word(7, 18); // "Comenta o nome": arrow + COMENTA + small text

// series badge: only the first 3 s (short fade out), nowhere else
export const BADGE_END = 3 * FPS;

// Transitions (whip + a soft filter sweep): at most 3 in the video (sound review of v5), always at the start of
// a new line: lagoon -> hunger, -> the crossing, -> the outer reef. Every other cut (hook -> lagoon, 5 -> 6,
// 6 -> the sand, 7 -> 8) is a hard cut, silent.
export const WHIPS = [S[2], S[3], S[4]];
