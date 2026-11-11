// Test of the earshot SFX workflow (not a channel video): kit effects placed on the actions of a
// 7 s cut-up, checked with scripts/sfx_sync_check.py.
import { kitFx, type KitFx } from "./kit";

export const FPS = 30;
export const DURATION = 210;
export const SFX_DIR = "sfxdemo/sfx";

export const FX: KitFx[] = [
  kitFx("whoosh.short", 30, 0),
  kitFx("pop", 45, 0),
  ...[60, 63, 66, 69, 72, 75].map((f, i) => kitFx("tick", f, i)),
  kitFx("hit", 90),
  kitFx("crack", 105),
  kitFx("whoosh.long", 120),
  kitFx("clank", 135),
  kitFx("drip", 150),
  kitFx("drip", 158, 1),
  // test: first placed by the start of its file (lead 0); the sync check measured its peak +158 ms
  // late and asked to move it -5 frames -> lead 5 (what kitFx computes from the kit lock)
  { ...kitFx("whoosh.short", 180, 1), lead: 0 + 5 },
];

/** the action frames (each one is a cut in the picture) */
export const ACTIONS = [...new Set(FX.map((x) => x.f))].sort((a, b) => a - b);
