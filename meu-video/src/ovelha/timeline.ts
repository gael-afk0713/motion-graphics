// "Ovelha" (sea sheep) — timing from the narration, used as delivered
// (already sped up and trimmed: no speed change, no cutting).
export const FPS = 30;
export const TAIL = 0.15;

type Block = { text: string; segs: number[]; size: number; allAtStart?: boolean };
type SceneDef = { file: string; dur: number; segs: [number, number][]; blocks: Block[] };

// segs = spoken stretches (seconds) from ffmpeg silencedetect (adaptive threshold, pauses >= 0.08s).
// blocks = on-screen text, EXACTLY the narration; *word* = yellow keyword (asterisks are not shown).
// " | " = line break at a natural point (max 2 lines). Every block uses the same font size;
// a sentence that does not fit two lines at that size continues in the next block
// (widths measured with Montserrat Black: every line <= 900px).
export const CAPTION_SIZE = 92; // one size for every scene (scene 1's size)
const Z = CAPTION_SIZE;
export const SCENES: SceneDef[] = [
  {
    file: "ovelha/ovelha1.mp3", dur: 2.847, segs: [[0, 1.592], [1.947, 2.847]],
    blocks: [
      { text: "Esse bichinho | parece *desenho…*", segs: [0], size: Z, allAtStart: true },
      { text: "mas é *REAL.*", segs: [1], size: Z },
    ],
  },
  {
    file: "ovelha/ovelha2.mp3", dur: 3.213, segs: [[0, 1.213], [1.368, 3.213]],
    blocks: [
      { text: "E ele faz | uma coisa", segs: [0], size: Z },
      { text: "que *quase* | *nenhum* *animal*", segs: [1], size: Z },
      { text: "consegue.", segs: [1], size: Z },
    ],
  },
  {
    file: "ovelha/ovelha3.mp3", dur: 3.631, segs: [[0, 1.03], [1.433, 3.631]],
    blocks: [
      { text: "É a | *ovelha-do-mar:*", segs: [0], size: Z },
      { text: "uma lesma | do tamanho", segs: [1], size: Z },
      { text: "de um *grão* | *de* *arroz.*", segs: [1], size: Z },
    ],
  },
  {
    file: "ovelha/ovelha4.mp3", dur: 3.918, segs: [[0, 1.31], [1.5, 3.795], [3.89, 3.918]],
    blocks: [
      { text: "Ela come | uma alga…", segs: [0], size: Z },
      { text: "e *rouba* | as peças", segs: [1, 2], size: Z },
      { text: "que fazem | *fotossíntese.*", segs: [1, 2], size: Z },
    ],
  },
  {
    file: "ovelha/ovelha5.mp3", dur: 6.217, segs: [[0, 0.358], [0.511, 2.068], [2.386, 3.496], [3.752, 4.972], [5.194, 6.217]],
    blocks: [
      { text: "Guarda tudo | nessas *folhinhas*", segs: [0, 1], size: Z },
      { text: "das costas.", segs: [0, 1], size: Z },
      { text: "E por | alguns dias…", segs: [2], size: Z },
      { text: "ela faz | *fotossíntese,*", segs: [3, 4], size: Z },
      { text: "igual a | uma *planta!*", segs: [3, 4], size: Z },
    ],
  },
  {
    file: "ovelha/ovelha6.mp3", dur: 3.997, segs: [[0, 0.628], [1.085, 1.407], [1.506, 2.656], [3.019, 3.997]],
    blocks: [
      { text: "O *problema?*", segs: [0], size: Z },
      { text: "Se ela para | de comer a alga…", segs: [1, 2], size: Z },
      { text: "o *verde* *some.*", segs: [3], size: Z },
    ],
  },
  {
    file: "ovelha/ovelha7.mp3", dur: 2.612, segs: [[0, 2.612]],
    blocks: [
      { text: "*Mande* *para* | *alguém*", segs: [0], size: Z },
      { text: "que ia querer | uma dessas", segs: [0], size: Z },
      { text: "de *estimação!*", segs: [0], size: Z },
    ],
  },
];

export const SCENE_DURATIONS = SCENES.map((s) => Math.ceil((s.dur + TAIL) * FPS));
export const S = SCENE_DURATIONS.map((_, i) => SCENE_DURATIONS.slice(0, i).reduce((a, b) => a + b, 0));
export const DURATION = SCENE_DURATIONS.reduce((a, b) => a + b, 0);
export const sceneEnd = (i: number) => S[i] + SCENE_DURATIONS[i];
export const at = (i: number, sec: number) => S[i] + Math.round(sec * FPS);
export const sceneOf = (f: number) => {
  for (let i = S.length - 1; i >= 0; i--) if (f >= S[i]) return i;
  return 0;
};
