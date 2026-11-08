import { FPS, S, SCENES } from "./timeline";

export const LEAD = 2; // a word pops in this many frames before it is spoken

const weight = (w: string) => (w.replace(/\*/g, "").match(/\p{L}|\d/gu) ?? []).length || 1;

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

export type Word = { text: string; key: boolean; appearAt: number; spokenAt: number };
export type CaptionBlock = { scene: number; size: number; words: Word[]; start: number };

export const BLOCKS: CaptionBlock[] = (() => {
  const out: CaptionBlock[] = [];
  SCENES.forEach((sc, si) => {
    // blocks sharing the same speech stretches are timed together
    const groups = new Map<string, number[]>();
    sc.blocks.forEach((b, bi) => {
      const k = b.segs.join(",");
      groups.set(k, [...(groups.get(k) ?? []), bi]);
    });
    const timed: Word[][] = sc.blocks.map(() => []);
    for (const [k, bis] of groups) {
      const segs = k.split(",").map((n) => sc.segs[+n]);
      const toks = bis.flatMap((bi) => sc.blocks[bi].text.split(" ").map((t) => ({ t, bi })));
      const total = toks.reduce((a, x) => a + weight(x.t), 0);
      let acc = 0;
      for (const { t, bi } of toks) {
        const sec = toFile(segs, acc / total);
        acc += weight(t);
        const spokenAt = S[si] + Math.round(sec * FPS);
        const all = sc.blocks[bi].allAtStart;
        timed[bi].push({
          text: t.replace(/\*/g, ""),
          key: t.includes("*"),
          spokenAt,
          appearAt: all ? 0 : Math.max(S[si], spokenAt - LEAD),
        });
      }
    }
    sc.blocks.forEach((b, bi) =>
      out.push({ scene: si, size: b.size, words: timed[bi], start: timed[bi][0].appearAt }),
    );
  });
  return out;
})();
