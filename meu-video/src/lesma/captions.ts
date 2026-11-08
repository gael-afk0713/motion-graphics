import { FPS, NARRATION, SCENE_STARTS } from "./timeline";

// On-screen line per scene. *word* = keyword (yellow). Emojis are glued to the
// previous word with a no-break space so they never sit alone on a line.
export const LINES: { text: string; fontSize: number; allAtStart?: boolean }[] = [
  { text: "Essa lesma *ROUBOU* o superpoder das plantas 🌿", fontSize: 104, allAtStart: true },
  { text: "Ela come uma alga… mas *NÃO* *DIGERE* *TUDO*", fontSize: 100 },
  { text: "Ela *GUARDA* os cloroplastos no corpo", fontSize: 100 },
  { text: "Uma lesma *MOVIDA* *A* *ENERGIA* *SOLAR* ☀️", fontSize: 100 },
  { text: "Até *10* *MESES* sem comer algas (em laboratório)", fontSize: 92 },
  { text: "Nem os cientistas sabem *COMO* 🤯", fontSize: 104 },
  { text: "Qual *superpoder* você roubaria? 👇", fontSize: 104 },
];

export const LEAD = 2; // frames a word pops in before it is spoken

const SPOKEN: Record<string, string> = { "10": "dez" };
const weight = (w: string) => {
  const core = w.split(" ")[0].replace(/\*/g, "");
  return ((SPOKEN[core] ?? core).match(/\p{L}|\d/gu) ?? []).length || 1;
};

/** Map a fraction of the *spoken* time (pauses removed) to a time in the file */
const speechToFile = (segs: readonly (readonly number[])[], frac: number) => {
  const total = segs.reduce((a, s) => a + (s[1] - s[0]), 0);
  let left = frac * total;
  for (const [a, b] of segs) {
    if (left <= b - a) return a + left;
    left -= b - a;
  }
  return segs[segs.length - 1][1];
};

export type Word = { text: string; key: boolean; appearAt: number; spokenAt: number };

export const sceneWords = (i: number): Word[] => {
  const tokens = LINES[i].text.split(" ");
  const ws = tokens.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  return tokens.map((t, k) => {
    const sec = speechToFile(NARRATION[i].segs, acc / total);
    acc += ws[k];
    const spokenAt = SCENE_STARTS[i] + Math.round(sec * FPS);
    return {
      text: t.replace(/\*/g, ""),
      key: t.includes("*"),
      spokenAt,
      // Scene 1: the whole line is on screen from frame 0
      appearAt: LINES[i].allAtStart ? 0 : Math.max(SCENE_STARTS[i], spokenAt - LEAD),
    };
  });
};
