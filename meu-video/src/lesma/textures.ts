import * as THREE from "three";

// Deterministic procedural textures (same in every render tab).
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Canvas space: x = u (tail 0 -> head 1), y = v (-1 top edge .. +1 bottom edge)
const W = 1024, H = 512;
const X = (u: number) => u * W;
const Y = (v: number) => (v * 0.5 + 0.5) * H;

type Vein = { pts: [number, number][]; w: number };

function veins(): Vein[] {
  const out: Vein[] = [];
  const mid: [number, number][] = [];
  for (let u = 0.04; u <= 0.86; u += 0.02) mid.push([u, 0]);
  out.push({ pts: mid, w: 10 });
  const r = rng(7);
  for (let u = 0.1; u <= 0.8; u += 0.075) {
    for (const side of [-1, 1]) {
      const pts: [number, number][] = [];
      const lean = 0.06 + r() * 0.03;
      for (let k = 0; k <= 10; k++) {
        const s = k / 10;
        pts.push([u + lean * s + 0.015 * Math.sin(s * 3), side * (0.04 + 0.86 * s)]);
      }
      out.push({ pts, w: 6 });
      // small side branches
      for (const s0 of [0.35, 0.65]) {
        const p = pts[Math.round(s0 * 10)];
        out.push({
          pts: [p, [p[0] + 0.035, p[1] + side * 0.06], [p[0] + 0.06, p[1] + side * 0.1]],
          w: 3.5,
        });
      }
    }
  }
  return out;
}

const drawVeins = (g: CanvasRenderingContext2D, color: string, scale = 1) => {
  g.strokeStyle = color;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const v of veins()) {
    g.lineWidth = v.w * scale;
    g.beginPath();
    v.pts.forEach(([u, vv], i) => (i ? g.lineTo(X(u), Y(vv)) : g.moveTo(X(u), Y(vv))));
    g.stroke();
  }
};

let cache: Record<string, THREE.Texture> | null = null;

export const getLesmaTextures = () => {
  if (cache) return cache;
  // --- body colour map
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#b9f27a");
  grad.addColorStop(0.07, "#2fd06c");
  grad.addColorStop(0.3, "#16a457");
  grad.addColorStop(0.5, "#0b7a43");
  grad.addColorStop(0.7, "#16a457");
  grad.addColorStop(0.93, "#2fd06c");
  grad.addColorStop(1, "#b9f27a");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  drawVeins(g, "rgba(170,255,190,0.85)");
  // head a bit darker, with two tiny eye spots
  g.fillStyle = "rgba(4,60,30,0.35)";
  g.fillRect(X(0.86), 0, W, H);
  g.fillStyle = "#02160c";
  for (const v of [-0.22, 0.22]) {
    g.beginPath();
    g.arc(X(0.9), Y(v), 7, 0, Math.PI * 2);
    g.fill();
  }
  // sparse red speckles typical of Elysia
  const r = rng(3);
  g.fillStyle = "rgba(255,90,90,0.8)";
  for (let i = 0; i < 70; i++) {
    g.beginPath();
    g.arc(X(0.05 + r() * 0.8), Y((r() * 2 - 1) * 0.8), 1.6 + r() * 1.6, 0, Math.PI * 2);
    g.fill();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  // --- emissive mask: veins glow (solar panel look)
  const e = document.createElement("canvas");
  e.width = W;
  e.height = H;
  const ge = e.getContext("2d")!;
  ge.fillStyle = "#0a2a14";
  ge.fillRect(0, 0, W, H);
  drawVeins(ge, "#ffffff", 1.4);
  const emissive = new THREE.CanvasTexture(e);
  emissive.colorSpace = THREE.SRGBColorSpace;

  // --- soft vertical ray (bright top -> transparent bottom)
  const rc = document.createElement("canvas");
  rc.width = 64;
  rc.height = 512;
  const gr = rc.getContext("2d")!;
  const lg = gr.createLinearGradient(0, 0, 0, 512);
  lg.addColorStop(0, "rgba(255,255,255,1)");
  lg.addColorStop(1, "rgba(255,255,255,0)");
  gr.fillStyle = lg;
  gr.fillRect(0, 0, 64, 512);
  const hg = gr.createLinearGradient(0, 0, 64, 0);
  hg.addColorStop(0, "rgba(0,0,0,1)");
  hg.addColorStop(0.5, "rgba(0,0,0,0)");
  hg.addColorStop(1, "rgba(0,0,0,1)");
  gr.globalCompositeOperation = "destination-out";
  gr.fillStyle = hg;
  gr.fillRect(0, 0, 64, 512);
  const ray = new THREE.CanvasTexture(rc);
  ray.colorSpace = THREE.SRGBColorSpace;

  // --- round soft dot for particles
  const pc = document.createElement("canvas");
  pc.width = 64;
  pc.height = 64;
  const gp = pc.getContext("2d")!;
  const rg = gp.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  gp.fillStyle = rg;
  gp.fillRect(0, 0, 64, 64);
  const dot = new THREE.CanvasTexture(pc);

  cache = { map, emissive, ray, dot };
  return cache;
};

export { rng };
