// "Foguete" — timing from the narration, used as delivered
// (already sped up and trimmed: no speed change, no cutting).
export const FPS = 30;
export const TAIL = 0.15;

type Block = {
  text: string;
  group: number;
  size?: number;
  side?: number;
  allAtStart?: boolean;
  // scene 7: caption in the lower third (above the TikTok description area), kept off the right-hand buttons
  top?: number;
  right?: number;
};
type SceneDef = {
  file: string;
  dur: number;
  tail?: number;
  segs: [number, number][][];
  blocks: Block[];
};

// segs = spoken stretches (seconds) from ffmpeg silencedetect (noise=-30dB, d=0.05s),
// grouped: blocks with the same `group` share that list of stretches and are timed together
// (each word weighted by its letters; "9" and "20" are weighted as spoken: "nove", "vinte").
// "^n" before a word = that word starts speech stretch n of its group (clear phrase gaps only).
// blocks = on-screen text, EXACTLY the narration; *word* = yellow keyword (asterisks not shown).
// " | " = line break (max 2 lines). Lines measured in Montserrat Black 92px: all <= 912px.
export const CAPTION_SIZE = 92; // same as "Ovelha"
// Block 1 must be complete on frame 0 and in 2 lines: "SpaceX bateu na Lua." is 1075px at 92px,
// so this one block is set at 86px with 40px side margins (widest line ~1000px).
const FIRST = { size: 86, side: 40 };
// scene 7 captions: lower third, lines <= 785px, right margin clear of the TikTok buttons
const LOWER = { top: 1250, side: 60, right: 220 };

export const SCENES: SceneDef[] = [
  {
    file: "foguete/foguete1.mp3",
    dur: 4.023,
    segs: [
      [
        [0, 0.741],
        [0.812, 1.511],
        [1.646, 2.296],
      ],
      [
        [2.684, 3.874],
        [3.977, 4.023],
      ],
    ],
    blocks: [
      {
        text: "Um foguete ^1da | SpaceX ^2*bateu* *na* *Lua.*",
        group: 0,
        allAtStart: true,
        ...FIRST,
      },
      { text: "E *ninguém* | *queria* isso.", group: 1 },
    ],
  },
  {
    file: "foguete/foguete2.mp3",
    dur: 4.31,
    segs: [
      [[0, 1.76]],
      [
        [1.959, 2.119],
        [2.173, 3.802],
        [3.872, 4.186],
        [4.282, 4.31],
      ],
    ],
    blocks: [
      { text: "Era um pedaço", group: 0 },
      { text: "de foguete | *abandonado,*", group: 0 },
      { text: "que ^1ficou | *mais* *de* *um* *ano*", group: 1 },
      { text: "à deriva | no espaço.", group: 1 },
    ],
  },
  {
    file: "foguete/foguete3.mp3",
    dur: 5.721,
    segs: [
      [[0, 0.937]],
      [[1.064, 2.325]],
      [
        [2.807, 4.949],
        [5.011, 5.587],
        [5.685, 5.721],
      ],
    ],
    blocks: [
      { text: "*Sem* *combustível,*", group: 0 },
      { text: "ele não conseguiu | desviar.", group: 1 },
      { text: "O Sol e a | gravidade", group: 2 },
      { text: "empurraram ele | *direto* *para* *a* *Lua.*", group: 2 },
    ],
  },
  {
    file: "foguete/foguete4.mp3",
    dur: 5.381,
    segs: [
      [
        [0, 0.309],
        [0.362, 2.108],
        [2.178, 2.603],
      ],
      [
        [2.809, 3.072],
        [3.148, 3.785],
        [3.894, 4.437],
        [4.502, 4.966],
        [5.068, 5.122],
        [5.349, 5.381],
      ],
    ],
    blocks: [
      { text: "Ele ^1bateu | a quase", group: 0 },
      { text: "*9* *mil* *quilômetros* | ^2*por* *hora*", group: 0 },
      { text: "e deve ter aberto | uma cratera", group: 1 },
      { text: "de uns | *20* *metros.*", group: 1 },
    ],
  },
  {
    file: "foguete/foguete5.mp3",
    dur: 6.922,
    segs: [
      [[0, 0.827]],
      [
        [1.27, 1.815],
        [1.875, 2.183],
      ],
      [
        [2.399, 4.076],
        [4.155, 4.257],
        [4.408, 4.698],
        [4.801, 4.826],
      ],
      [
        [5.171, 5.729],
        [5.797, 6.61],
        [6.662, 6.792],
        [6.874, 6.922],
      ],
    ],
    blocks: [
      { text: "E o mais | curioso?", group: 0 },
      { text: "Na época | da Apollo,", group: 1 },
      { text: "a NASA jogava | foguetes na Lua", group: 2 },
      { text: "^1*de* *propósito,*", group: 2 },
      { text: "para medir os | *tremores* *lunares.*", group: 3 },
    ],
  },
  {
    file: "foguete/foguete6.mp3",
    dur: 2.9,
    segs: [
      [
        [0, 1.5],
        [1.554, 2.168],
        [2.239, 2.317],
        [2.429, 2.772],
        [2.869, 2.9],
      ],
    ],
    blocks: [
      { text: "*Mande* *para* | *alguém*", group: 0 },
      { text: "que ainda acha | que a Lua", group: 0 },
      { text: "é *intocada!*", group: 0 },
    ],
  },
  {
    // scene 7: the plaque on the Moon. dur = ffprobe of foguete7.mp3 (4.179592 s), tail 0.25 s
    file: "foguete/foguete7.mp3",
    dur: 4.18,
    tail: 0.25,
    segs: [
      [[0, 1.951]],
      [
        [2.252, 2.655],
        [2.746, 3.205],
        [3.267, 4.007],
        [4.128, 4.18],
      ],
    ],
    blocks: [
      { text: "Se você gosta | de curiosidades", group: 0, ...LOWER },
      { text: "como essa,", group: 0, ...LOWER },
      { text: "*curta,* ^1*siga* e | ^2*compartilhe!*", group: 1, ...LOWER },
    ],
  },
];

export const SCENE_DURATIONS = SCENES.map((s) =>
  Math.ceil((s.dur + (s.tail ?? TAIL)) * FPS),
);
export const S = SCENE_DURATIONS.map((_, i) =>
  SCENE_DURATIONS.slice(0, i).reduce((a, b) => a + b, 0),
);
export const DURATION = SCENE_DURATIONS.reduce((a, b) => a + b, 0);
export const sceneEnd = (i: number) => S[i] + SCENE_DURATIONS[i];
export const at = (i: number, sec: number) => S[i] + Math.round(sec * FPS);
export const sceneOf = (f: number) => {
  for (let i = S.length - 1; i >= 0; i--) if (f >= S[i]) return i;
  return 0;
};

// scene 4: the moment the stage hits the ground (BOOM)
export const IMPACT = at(3, 0.5);
// scene 5: the Apollo-era stage hits the ground
export const IMPACT5 = at(4, 2.45);
