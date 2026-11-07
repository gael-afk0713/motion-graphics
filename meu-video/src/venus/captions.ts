// On-screen captions: exactly the spoken words, timed to the narration.
// Segment times are seconds in the final video (measured on the rendered
// out/video-voz.mp4 and confirmed with ffmpeg silencedetect).
//
// Inside a segment, each word starts proportionally to how long it takes to
// say (letters of its spoken form) and pops in LEAD frames before the voice.
// *word* = keyword (yellow). "|" inside text is not used; one segment = one
// spoken stretch.

const FPS = 30;
export const LEAD = 2;

type Segment = { t0: number; t1: number; text: string };
export type CaptionBlock = {
  id: string;
  segments: Segment[];
  fontSize: number;
  center?: boolean;
};

export const CAPTIONS: CaptionBlock[] = [
  {
    id: "intro",
    fontSize: 112,
    segments: [
      { t0: 0.0, t1: 1.19, text: "Esse planeta" },
      { t0: 1.47, t1: 2.53, text: "*QUEBRA* *TODAS* as regras" },
    ],
  },
  {
    id: "spin",
    fontSize: 100,
    segments: [
      { t0: 2.86, t1: 5.72, text: "Vênus leva *243* *DIAS*" },
      { t0: 5.99, t1: 7.77, text: "pra girar uma única vez" },
    ],
  },
  {
    id: "orbit",
    fontSize: 100,
    segments: [{ t0: 8.07, t1: 11.23, text: "Mas só *225* pra dar a volta no *Sol*" }],
  },
  {
    id: "compare",
    fontSize: 90,
    segments: [
      { t0: 11.53, t1: 12.12, text: "Ou seja:" },
      { t0: 12.5, t1: 14.92, text: "um *DIA* em Vênus dura mais que um *ANO* inteiro 🤯" },
    ],
  },
  {
    id: "more",
    fontSize: 112,
    segments: [{ t0: 15.1, t1: 16.62, text: "E tem mais..." }],
  },
  {
    id: "west",
    fontSize: 112,
    segments: [
      { t0: 17.02, t1: 17.57, text: "lá," },
      { t0: 17.77, t1: 19.6, text: "o Sol nasce no *OESTE*" },
    ],
  },
  {
    id: "cta",
    fontSize: 104,
    center: true,
    segments: [{ t0: 19.93, t1: 21.63, text: "Segue pra mais *curiosidades* 🚀" }],
  },
];

// How the word is actually said, for proportional timing
const SPOKEN: Record<string, string> = {
  "243": "duzentos e quarenta e três",
  "225": "duzentos e vinte e cinco",
};

const weight = (word: string) => {
  const spoken = SPOKEN[word] ?? word;
  return (spoken.match(/\p{L}/gu) ?? []).length || 1;
};

export type CaptionWord = {
  text: string;
  key: boolean;
  /** absolute frame at which the voice starts this word */
  spokenAt: number;
  /** absolute frame at which the word pops in (LEAD frames earlier) */
  appearAt: number;
};

export const blockWords = (block: CaptionBlock): CaptionWord[] =>
  block.segments.flatMap((seg) => {
    const tokens = seg.text.split(" ");
    const clean = tokens.map((t) => t.replace(/\*/g, ""));
    const weights = clean.map((t) => weight(t.split(" ")[0]));
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    return tokens.map((t, i) => {
      const sec = seg.t0 + (acc / total) * (seg.t1 - seg.t0);
      acc += weights[i];
      const spokenAt = Math.round(sec * FPS);
      return {
        text: clean[i],
        key: t.includes("*"),
        spokenAt,
        appearAt: Math.max(0, spokenAt - LEAD),
      };
    });
  });

export const blockStart = (block: CaptionBlock) => blockWords(block)[0].appearAt;

/** Absolute frame at which `word` (first match) is spoken in caption `id` */
export const spokenFrame = (id: string, word: string) => {
  const block = CAPTIONS.find((b) => b.id === id)!;
  const w = blockWords(block).find((x) => x.text.split(" ")[0] === word);
  if (!w) throw new Error(`Word ${word} not in caption ${id}`);
  return w.spokenAt;
};

/** Absolute frame at which caption `id`'s segment `k` ends */
export const segmentEnd = (id: string, k: number) =>
  Math.round(CAPTIONS.find((b) => b.id === id)!.segments[k].t1 * FPS);
