// "Peixe-papagaio – parte 3/3": colour of the approved fish WITHOUT touching its model.
// Fish.tsx and gfx.ts stay exactly as approved (shape, size, beak, eye, scales). This wrapper only swaps
// the texture images the fish's own materials use, through a new property `colorMode`:
//   colorMode = 0 -> the initial phase (grey-brown female, as in parts 1 and 2)
//   colorMode = 1 -> the terminal phase (vivid blue-green with pink and orange marks, like the adult male
//                    of the real photos)
//   in between     -> a soft wave of colour from the head to the tail, with a soft glow on the wave front
// It also offers a `palette` for the other females (different greys / browns) and `vanish` (the old male
// dissolving into sparkles: it shrinks away while the sparkles burst out; no gore).
import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Fish, FishProps } from "../papagaio/Fish";
import { finTexture, fishSkin, FishPalette, INITIAL_PHASE, memo, rng, softSprite } from "../papagaio/gfx";

// terminal phase (male): blue-green body, scale rims a deeper teal, pink/orange around the mouth
export const TERMINAL: FishPalette = {
  back: "#1d7f86",
  side: "#2bb39b",
  belly: "#7fd6b4",
  head: "#2a9a9a",
  chin: "#ef8fae",
  edge: "#0d4b56",
};
// other females of the group: the same grey-brown family, a little lighter / darker / warmer
export const FEMALES: FishPalette[] = [
  { back: "#5f5752", side: "#7f6c63", belly: "#b9533f", head: "#776a64", chin: "#c4624f", edge: "#2f201d" },
  { back: "#776a5f", side: "#9a8576", belly: "#c45e48", head: "#8d7d71", chin: "#cf735c", edge: "#3a2a22" },
  { back: "#5a5653", side: "#77706b", belly: "#b4604f", head: "#6e6865", chin: "#c06f5e", edge: "#2a2321" },
  { back: "#6e5f55", side: "#8f7465", belly: "#c25a44", head: "#82705f", chin: "#cc6a52", edge: "#36231b" },
];

const imgOf = (t: THREE.Texture) => t.image as HTMLCanvasElement;

/** the terminal skin: the approved scale pattern in male colours + pink / orange marks */
const terminalCanvas = () =>
  memo("p3TerminalSkin", () => {
    const src = imgOf(fishSkin(TERMINAL, "p3terminal").map);
    const W = src.width;
    const H = src.height;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.drawImage(src, 0, 0);
    const r = rng(77);
    // pink / orange rims on the scales of the flank (as on the real male), soft
    g.globalAlpha = 0.5;
    for (let i = 0; i < 70; i++) {
      const x = 0.24 * W + r() * 0.74 * W;
      const y = 0.18 * H + r() * 0.64 * H;
      g.strokeStyle = r() > 0.5 ? "#f39ac0" : "#f6a35a";
      g.lineWidth = 4 + r() * 3;
      g.beginPath();
      g.arc(x, y, 9 + r() * 7, Math.PI * 0.6, Math.PI * 1.4);
      g.stroke();
    }
    // pink / orange stripes on the head: around the mouth and from the eye backwards
    g.globalAlpha = 0.85;
    g.lineCap = "round";
    const stripe = (pts: number[][], col: string, w: number) => {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(pts[0][0] * W, pts[0][1] * H);
      for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0] * W, pts[k][1] * H);
      g.stroke();
    };
    stripe([[0.01, 0.62], [0.06, 0.66], [0.13, 0.7]], "#f48fb4", 14);
    stripe([[0.01, 0.36], [0.07, 0.33], [0.15, 0.31]], "#f6a35a", 10);
    stripe([[0.19, 0.32], [0.25, 0.4], [0.3, 0.42]], "#f48fb4", 9);
    stripe([[0.18, 0.5], [0.24, 0.56]], "#f6a35a", 8);
    // an orange band along the belly
    g.globalAlpha = 0.45;
    const gb = g.createLinearGradient(0, 0.72 * H, 0, 0.86 * H);
    gb.addColorStop(0, "rgba(246,163,90,0)");
    gb.addColorStop(0.5, "rgba(246,163,90,1)");
    gb.addColorStop(1, "rgba(246,163,90,0)");
    g.fillStyle = gb;
    g.fillRect(0.2 * W, 0.72 * H, 0.75 * W, 0.14 * H);
    g.globalAlpha = 1;
    return c;
  });
// fins: blue-green with a pink edge (same fin texture function, new colours)
const TERMINAL_FIN = () => finTexture("#1f9c95", "#f08fb4", "#0e5a5e");

/** wave of colour: a over b, b visible where x < front (in texture space, 0 = snout), soft edge + glow */
const composite = (dst: HTMLCanvasElement, a: HTMLCanvasElement, b: HTMLCanvasElement, wave: number, glow: boolean) => {
  const W = dst.width;
  const H = dst.height;
  const g = dst.getContext("2d")!;
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.clearRect(0, 0, W, H);
  g.drawImage(a, 0, 0, W, H);
  if (wave <= 0) return;
  if (wave >= 1) {
    g.drawImage(b, 0, 0, W, H);
    return;
  }
  const soft = 0.18;
  const front = -soft + wave * (1 + 2 * soft);
  const tmp = memo(`p3tmp${W}x${H}`, () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  });
  const tg = tmp.getContext("2d")!;
  tg.globalCompositeOperation = "source-over";
  tg.clearRect(0, 0, W, H);
  tg.drawImage(b, 0, 0, W, H);
  tg.globalCompositeOperation = "destination-in";
  const m = tg.createLinearGradient(0, 0, W, 0);
  const s0 = Math.min(1, Math.max(0, front - soft));
  const s1 = Math.min(1, Math.max(0, front + soft));
  m.addColorStop(0, "rgba(0,0,0,1)");
  if (s0 > 0) m.addColorStop(s0, "rgba(0,0,0,1)");
  m.addColorStop(Math.min(1, Math.max(s0 + 0.0001, s1)), "rgba(0,0,0,0)");
  m.addColorStop(1, "rgba(0,0,0,0)");
  tg.fillStyle = m;
  tg.fillRect(0, 0, W, H);
  g.drawImage(tmp, 0, 0);
  if (glow) {
    // a soft bright band riding on the wave front
    g.globalCompositeOperation = "lighter";
    const gl = g.createLinearGradient(0, 0, W, 0);
    const c0 = Math.min(1, Math.max(0, front - soft * 0.9));
    const c1 = Math.min(1, Math.max(0, front));
    const c2 = Math.min(1, Math.max(0, front + soft * 0.9));
    gl.addColorStop(0, "rgba(255,255,255,0)");
    if (c0 > 0) gl.addColorStop(c0, "rgba(255,255,255,0)");
    gl.addColorStop(Math.min(1, Math.max(c0 + 0.0001, c1)), "rgba(190,255,240,0.38)");
    gl.addColorStop(Math.min(1, Math.max(c1 + 0.0002, c2)), "rgba(255,255,255,0)");
    gl.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
  }
};

type MatWithMap = THREE.Material & { map?: THREE.Texture | null; userData: Record<string, unknown> };

export type ColorFishProps = FishProps & {
  /** NEW property (parte 3): 0 = initial phase (female), 1 = terminal phase (male), between = colour wave */
  colorMode?: number;
  /** 0..1: the fish dissolves into sparkles (shrinks away, sparkles burst out) */
  vanish?: number;
};

export const ColorFish: React.FC<ColorFishProps> = ({ colorMode = 0, vanish = 0, palette = INITIAL_PHASE, paletteKey = "initial", scale, position, rotation, ...props }) => {
  const ref = useRef<THREE.Group>(null);
  const skin = fishSkin(palette, paletteKey);
  const fin0 = finTexture();
  const dyn = useMemo(() => {
    const mk = (src: HTMLCanvasElement) => {
      const c = document.createElement("canvas");
      c.width = src.width;
      c.height = src.height;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return { c, t };
    };
    return { body: mk(imgOf(skin.map)), fin: mk(imgOf(fin0)) };
  }, [skin, fin0]);
  const k = Math.min(1, Math.max(0, colorMode));
  const swap = k > 0.0001;
  if (swap) {
    composite(dyn.body.c, imgOf(skin.map), terminalCanvas(), k, k < 1);
    // the fins follow when the wave reaches the middle of the body
    composite(dyn.fin.c, imgOf(fin0), imgOf(TERMINAL_FIN()), Math.min(1, Math.max(0, (k - 0.3) / 0.6)), false);
    dyn.body.t.needsUpdate = true;
    dyn.fin.t.needsUpdate = true;
  }
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MatWithMap[];
      for (const m of mats) {
        if (!m) continue;
        const orig = (m.userData.p3orig as THREE.Texture | undefined) ?? m.map ?? undefined;
        if (!orig) continue;
        if (orig === skin.map || orig === fin0) {
          m.userData.p3orig = orig;
          const want = swap ? (orig === skin.map ? dyn.body.t : dyn.fin.t) : orig;
          if (m.map !== want) {
            m.map = want;
            m.needsUpdate = true;
          }
        }
      }
    });
  });
  const v = Math.min(1, Math.max(0, vanish));
  const base = typeof scale === "number" ? scale : 1;
  const shrink = v <= 0 ? 1 : Math.max(0.0001, (1 - v) ** 1.6);
  return (
    <group position={position} rotation={rotation}>
      <group ref={ref} scale={base * shrink}>
        <Fish palette={palette} paletteKey={paletteKey} {...props} />
        {v > 0 && v < 1 && <Sparkles v={v} />}
      </group>
    </group>
  );
};

/** the sparkles the vanishing fish turns into (fish space; they grow out as the fish shrinks) */
const Sparkles: React.FC<{ v: number }> = ({ v }) => {
  const pts = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 70 }, () => ({
      p: new THREE.Vector3((r() - 0.5) * 2.0, (r() - 0.5) * 0.7, (r() - 0.5) * 0.4),
      d: new THREE.Vector3(r() - 0.5, r() - 0.2, r() - 0.5).normalize(),
      s: 0.08 + r() * 0.12,
      ph: r() * 6.28,
    }));
  }, []);
  const inv = 1 / Math.max(0.05, (1 - v) ** 1.6); // cancel the shrink of the parent
  return (
    <group scale={inv}>
      {pts.map((q, i) => {
        const o = Math.sin(Math.PI * Math.min(1, v * 1.1)) * (0.6 + 0.4 * Math.sin(v * 30 + q.ph));
        const pos = q.p.clone().addScaledVector(q.d, v * 1.4);
        const s = q.s * (0.6 + v);
        return (
          <sprite key={i} position={pos} scale={[s, s, s]} renderOrder={25}>
            <spriteMaterial map={softSprite()} color={i % 3 ? "#fff6c8" : "#bff8ff"} transparent opacity={Math.max(0, o)} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        );
      })}
    </group>
  );
};
