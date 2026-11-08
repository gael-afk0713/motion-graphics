// "Ovelha" (sea sheep) — timing from the narration, used as delivered
// (already sped up and trimmed: no speed change, no cutting).
export const FPS = 30;
export const TAIL = 0.15;

type Block = { text: string; segs: number[]; size: number; allAtStart?: boolean };
type SceneDef = { file: string; dur: number; segs: [number, number][]; blocks: Block[] };

// segs = spoken stretches (seconds) from ffmpeg silencedetect (adaptive threshold, pauses >= 0.08s).
// blocks = on-screen text, EXACTLY the narration; *word* = yellow keyword (asterisks are not shown).
// size = largest font size (px) that keeps the block within 2 lines (measured with Montserrat Black).
export const SCENES: SceneDef[] = [
  {
    file: "ovelha/ovelha1.mp3", dur: 2.847, segs: [[0, 1.592], [1.947, 2.847]],
    blocks: [
      { text: "Esse bichinho parece *desenho…*", segs: [0], size: 94, allAtStart: true },
      { text: "mas é *REAL.*", segs: [1], size: 100 },
    ],
  },
  {
    file: "ovelha/ovelha2.mp3", dur: 3.213, segs: [[0, 1.213], [1.368, 3.213]],
    blocks: [
      { text: "E ele faz uma coisa", segs: [0], size: 100 },
      { text: "que *quase* *nenhum* *animal* consegue.", segs: [1], size: 88 },
    ],
  },
  {
    file: "ovelha/ovelha3.mp3", dur: 3.631, segs: [[0, 1.03], [1.433, 3.631]],
    blocks: [
      { text: "É a *ovelha-do-mar:*", segs: [0], size: 100 },
      { text: "uma lesma do tamanho de um *grão* *de* *arroz.*", segs: [1], size: 72 },
    ],
  },
  {
    file: "ovelha/ovelha4.mp3", dur: 3.918, segs: [[0, 1.31], [1.5, 3.795], [3.89, 3.918]],
    blocks: [
      { text: "Ela come uma alga…", segs: [0], size: 100 },
      { text: "e *rouba* as peças que fazem *fotossíntese.*", segs: [1, 2], size: 80 },
    ],
  },
  {
    file: "ovelha/ovelha5.mp3", dur: 6.217, segs: [[0, 0.358], [0.511, 2.068], [2.386, 3.496], [3.752, 4.972], [5.194, 6.217]],
    blocks: [
      { text: "Guarda tudo nessas *folhinhas* das costas.", segs: [0, 1], size: 80 },
      { text: "E por alguns dias…", segs: [2], size: 100 },
      { text: "ela faz *fotossíntese,* igual a uma *planta!*", segs: [3, 4], size: 84 },
    ],
  },
  {
    file: "ovelha/ovelha6.mp3", dur: 3.997, segs: [[0, 0.628], [1.085, 1.407], [1.506, 2.656], [3.019, 3.997]],
    blocks: [
      { text: "O *problema?*", segs: [0], size: 100 },
      { text: "Se ela para de comer a alga…", segs: [1, 2], size: 100 },
      { text: "o *verde* *some.*", segs: [3], size: 100 },
    ],
  },
  {
    // no pause in this line: split at a phrase boundary, timed proportionally
    file: "ovelha/ovelha7.mp3", dur: 2.612, segs: [[0, 2.612]],
    blocks: [
      { text: "*Mande* *para* *alguém*", segs: [0], size: 100 },
      { text: "que ia querer uma dessas de *estimação!*", segs: [0], size: 78 },
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
