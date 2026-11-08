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

export type Word = { text: string; key: boolean; line: number; appearAt: number; spokenAt: number; endAt: number };
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
      const toks = bis.flatMap((bi) =>
        sc.blocks[bi].text.split(" | ").flatMap((ln, li) => ln.split(" ").map((t) => ({ t, bi, li }))),
      );
      const total = toks.reduce((a, x) => a + weight(x.t), 0);
      let acc = 0;
      for (const { t, bi, li } of toks) {
        const sec = toFile(segs, acc / total);
        acc += weight(t);
        const spokenAt = S[si] + Math.round(sec * FPS);
        const all = sc.blocks[bi].allAtStart;
        timed[bi].push({
          text: t.replace(/\*/g, ""),
          key: t.includes("*"),
          line: li,
          spokenAt,
          endAt: spokenAt, // filled below
          appearAt: all ? 0 : Math.max(S[si], spokenAt - LEAD),
        });
      }
    }
    sc.blocks.forEach((b, bi) => {
      const ws = timed[bi];
      // a word stays highlighted until the next one is spoken (last one: end of its speech stretch)
      const lastSeg = sc.segs[b.segs[b.segs.length - 1]];
      ws.forEach((w, k) => (w.endAt = k + 1 < ws.length ? ws[k + 1].spokenAt : S[si] + Math.round(lastSeg[1] * FPS)));
      // karaoke: the whole block appears at once, a few frames before its first word
      const start = b.allAtStart ? 0 : Math.max(S[si], ws[0].spokenAt - LEAD);
      out.push({ scene: si, size: b.size, words: ws, start });
    });
  });
  return out;
})();
