import { FPS, S, SCENES, CAPTION_SIZE } from "./timeline";

export const LEAD = 2; // a block appears this many frames before its first word is spoken

const SPOKEN: Record<string, string> = { "9": "nove", "20": "vinte" };
const weight = (w: string) => {
  const t = w.replace(/\*/g, "");
  const s = SPOKEN[t] ?? t;
  return (s.match(/\p{L}|\d/gu) ?? []).length || 1;
};

// fraction of spoken time (pauses removed) -> seconds in the file
const toFile = (segs: [number, number][], frac: number) => {
  const total = segs.reduce((a, s) => a + s[1] - s[0], 0);
  let left = frac * total;
  for (const [a, b] of segs) {
    if (left <= b - a + 1e-9) return a + left;
    left -= b - a;
  }
  return segs[segs.length - 1][1];
};

export type Word = {
  text: string;
  key: boolean;
  line: number;
  spokenAt: number;
  endAt: number;
  keyRunStart: boolean;
};
export type CaptionBlock = {
  scene: number;
  size: number;
  side: number;
  top?: number;
  right?: number;
  words: Word[];
  start: number;
};

export const BLOCKS: CaptionBlock[] = (() => {
  const out: CaptionBlock[] = [];
  SCENES.forEach((sc, si) => {
    const timed: Word[][] = sc.blocks.map(() => []);
    sc.segs.forEach((segs, gi) => {
      const toks = sc.blocks.flatMap((b, bi) =>
        b.group !== gi
          ? []
          : b.text
              .split(" | ")
              .flatMap((ln, li) => ln.split(" ").map((t) => ({ t, bi, li }))),
      );
      // chunks: "^n" markers pin a word to the start of stretch n
      const marks = toks
        .map((x) => /^\^(\d+)/.exec(x.t))
        .map((m) => (m ? +m[1] : -1));
      const starts = [
        0,
        ...marks.map((m, i) => (m > 0 ? i : -1)).filter((i) => i > 0),
        toks.length,
      ];
      for (let c = 0; c + 1 < starts.length; c++) {
        const a = starts[c];
        const z = starts[c + 1];
        const s0 = c === 0 ? 0 : marks[a];
        const s1 = z < toks.length ? marks[z] : segs.length;
        const chunkSegs = segs.slice(s0, s1);
        const part = toks.slice(a, z);
        const total = part.reduce((acc, x) => acc + weight(x.t), 0);
        let acc = 0;
        for (const { t: raw, bi, li } of part) {
          const t = raw.replace(/^\^\d+/, "");
          const sec = toFile(chunkSegs, acc / total);
          acc += weight(t);
          timed[bi].push({
            text: t.replace(/\*/g, ""),
            key: t.includes("*"),
            line: li,
            spokenAt: S[si] + Math.round(sec * FPS),
            endAt: 0,
            keyRunStart: false,
          });
        }
      }
    });
    sc.blocks.forEach((b, bi) => {
      const ws = timed[bi];
      const segs = sc.segs[b.group];
      const groupEnd = S[si] + Math.round(segs[segs.length - 1][1] * FPS);
      // next word of the same group (may be in the next block)
      const nextBlockFirst = sc.blocks
        .slice(bi + 1)
        .findIndex((x) => x.group === b.group);
      const after =
        nextBlockFirst >= 0
          ? timed[bi + 1 + nextBlockFirst][0].spokenAt
          : groupEnd;
      ws.forEach((w, k) => {
        w.endAt = k + 1 < ws.length ? ws[k + 1].spokenAt : after;
        w.keyRunStart = w.key && (k === 0 || !ws[k - 1].key);
      });
      const start = b.allAtStart ? 0 : Math.max(S[si], ws[0].spokenAt - LEAD);
      out.push({
        scene: si,
        size: b.size ?? CAPTION_SIZE,
        side: b.side ?? 80,
        top: b.top,
        right: b.right,
        words: ws,
        start,
      });
    });
  });
  return out;
})();

// frames at which a yellow keyword run starts being spoken (camera punch-in)
export const PUNCHES: number[] = BLOCKS.flatMap((b) =>
  b.words.filter((w) => w.keyRunStart).map((w) => w.spokenAt),
);
