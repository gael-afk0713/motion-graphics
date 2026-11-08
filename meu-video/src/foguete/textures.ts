import * as THREE from "three";

// Deterministic procedural textures (identical in every render tab).

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash3 = (x: number, y: number, z: number) => {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffffff) / 0xffffff;
};
const sm = (t: number) => t * t * (3 - 2 * t);
const vnoise = (x: number, y: number, z: number) => {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = sm(x - xi),
    yf = sm(y - yi),
    zf = sm(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(
      l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf),
      l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf),
      yf,
    ),
    l(
      l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf),
      l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf),
      yf,
    ),
    zf,
  );
};
const fbm = (x: number, y: number, z: number, oct: number) => {
  let s = 0,
    a = 0.5,
    f = 1,
    n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
};

// crater radial height profile (r in crater radii): bowl, raised rim, soft ejecta
const craterProfile = (r: number, fresh: number) => {
  if (r < 1)
    return -1 + r * r * 1.15 + (r > 0.85 ? (0.35 * (r - 0.85)) / 0.15 : 0);
  const rim = Math.exp(-(((r - 1) / (0.12 + 0.1 * (1 - fresh))) ** 2)) * 0.5;
  const ej = r < 2.6 ? 0.12 * (1 - (r - 1) / 1.6) ** 2 : 0;
  return rim + ej;
};

const toCanvasTex = (c: HTMLCanvasElement, srgb: boolean) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};

const heightToNormal = (
  h: Float32Array,
  W: number,
  H: number,
  strength: number,
  sphere: boolean,
  wrapY: boolean,
) => {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = sphere ? Math.cos(((y + 0.5) / H - 0.5) * Math.PI) : 1;
    const yu = wrapY ? (y - 1 + H) % H : Math.max(0, y - 1);
    const yd = wrapY ? (y + 1) % H : Math.min(H - 1, y + 1);
    for (let x = 0; x < W; x++) {
      const xl = (x - 1 + W) % W,
        xr = (x + 1) % W;
      let dx = (h[y * W + xr] - h[y * W + xl]) * strength;
      const dy = (h[yd * W + x] - h[yu * W + x]) * strength;
      if (sphere) dx /= Math.max(0.15, lat);
      const nx = -dx,
        ny = dy,
        nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * W + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toCanvasTex(c, false);
};

// ---------------------------------------------------------------------------
// The Moon (equirectangular albedo + normal map)
// ---------------------------------------------------------------------------
let moonCache: {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
} | null = null;
export const getMoonTextures = () => {
  if (moonCache) return moonCache;
  const W = 2048,
    H = 1024;
  const h = new Float32Array(W * H);
  const alb = new Float32Array(W * H);
  // low-res fbm for maria and large-scale tone (bilinear upsampled)
  const LW = 512,
    LH = 256;
  const maria = new Float32Array(LW * LH),
    tone = new Float32Array(LW * LH);
  for (let y = 0; y < LH; y++) {
    const th = ((y + 0.5) / LH) * Math.PI;
    for (let x = 0; x < LW; x++) {
      const ph = ((x + 0.5) / LW) * Math.PI * 2;
      const px = Math.sin(th) * Math.cos(ph),
        py = Math.cos(th),
        pz = Math.sin(th) * Math.sin(ph);
      maria[y * LW + x] = fbm(px * 1.6 + 11, py * 1.6 + 3, pz * 1.6 + 7, 5);
      tone[y * LW + x] = fbm(px * 6 + 1, py * 6 + 5, pz * 6 + 2, 5);
    }
  }
  const samp = (a: Float32Array, u: number, v: number) => {
    const x = u * LW - 0.5,
      y = Math.min(LH - 1.001, Math.max(0, v * LH - 0.5));
    const x0 = Math.floor(x),
      y0 = Math.floor(y),
      fx = x - x0,
      fy = y - y0;
    const xa = ((x0 % LW) + LW) % LW,
      xb = (xa + 1) % LW;
    const r0 = a[y0 * LW + xa] * (1 - fx) + a[y0 * LW + xb] * fx;
    const r1 = a[(y0 + 1) * LW + xa] * (1 - fx) + a[(y0 + 1) * LW + xb] * fx;
    return r0 * (1 - fy) + r1 * fy;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W,
        v = (y + 0.5) / H;
      const m = samp(maria, u, v);
      const mare = sm(Math.min(1, Math.max(0, (m - 0.5) / 0.07)));
      const t = samp(tone, u, v);
      alb[y * W + x] = 0.66 + 0.22 * (t - 0.5) - 0.36 * mare;
      h[y * W + x] = -0.6 * mare + 0.5 * (t - 0.5);
    }
  // craters (power-law sizes), radii in pixels at the equator
  const r = rng(42);
  const addCrater = (
    cx: number,
    cy: number,
    rad: number,
    depth: number,
    fresh: number,
  ) => {
    const lat = Math.cos((cy / H - 0.5) * Math.PI);
    const rx = Math.min(W / 2, (rad * 2.7) / Math.max(0.08, lat));
    const ry = rad * 2.7;
    for (
      let y = Math.max(0, Math.floor(cy - ry));
      y < Math.min(H, Math.ceil(cy + ry));
      y++
    ) {
      const la = Math.cos((y / H - 0.5) * Math.PI);
      for (let xx = Math.floor(cx - rx); xx < Math.ceil(cx + rx); xx++) {
        const x = ((xx % W) + W) % W;
        const dx = (xx - cx) * la,
          dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / rad;
        if (d > 2.7) continue;
        const i = y * W + x;
        h[i] += depth * craterProfile(d, fresh);
        if (fresh > 0.6)
          alb[i] += 0.12 * fresh * Math.max(0, 1 - Math.abs(d - 1.05) / 0.7);
        else if (d < 1) alb[i] -= 0.03;
      }
    }
  };
  for (let k = 0; k < 2600; k++) {
    const u = r();
    const rad = 1.2 + 40 * Math.pow(u, 9) + 2.2 * r();
    // fewer craters on the maria (smooth dark plains)
    const cx = r() * W,
      cy = (Math.acos(1 - 2 * r()) / Math.PI) * H;
    if (samp(maria, cx / W, cy / H) > 0.55 && r() < 0.7) continue;
    addCrater(cx, cy, rad, 0.35 + 0.4 * r(), r());
  }
  for (let k = 0; k < 28; k++)
    addCrater(r() * W, (0.15 + 0.7 * r()) * H, 22 + 50 * r() * r(), 0.9, r());
  // a few bright young craters with rays
  for (let k = 0; k < 4; k++) {
    const cx = r() * W,
      cy = (0.25 + 0.5 * r()) * H,
      rad = 8 + 6 * r();
    addCrater(cx, cy, rad, 1.2, 1);
    for (let j = 0; j < 26; j++) {
      const a = r() * Math.PI * 2,
        len = rad * (4 + 9 * r());
      for (let s = rad; s < len; s += 1) {
        const px = Math.round(cx + Math.cos(a) * s),
          py = Math.round(cy + Math.sin(a) * s);
        if (py < 0 || py >= H) continue;
        const ii = py * W + (((px % W) + W) % W);
        alb[ii] += 0.09 * (1 - s / len);
      }
    }
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const a = Math.max(0, Math.min(1, alb[i] + 0.04 * (hash3(i, 7, 3) - 0.5)));
    img.data[i * 4] = a * 238;
    img.data[i * 4 + 1] = a * 232;
    img.data[i * 4 + 2] = a * 224;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  moonCache = {
    map: toCanvasTex(c, true),
    normal: heightToNormal(h, W, H, 2.2, true, false),
  };
  return moonCache;
};

// ---------------------------------------------------------------------------
// Close-up regolith (tileable): height field function shared by geometry + textures
// ---------------------------------------------------------------------------
type Crater = { x: number; z: number; r: number; d: number };
let groundCraters: Crater[] | null = null;
const GROUND_SPAN = 240; // metres, the crater pattern tiles every GROUND_SPAN
const getGroundCraters = () => {
  if (groundCraters) return groundCraters;
  const r = rng(7);
  const out: Crater[] = [];
  for (let k = 0; k < 260; k++) {
    const u = r();
    out.push({
      x: (r() - 0.5) * GROUND_SPAN,
      z: (r() - 0.5) * GROUND_SPAN,
      r: 1.5 + 22 * Math.pow(u, 5) + 2 * r(),
      d: 0.13 + 0.08 * r(),
    });
  }
  groundCraters = out.filter((c) => Math.hypot(c.x, c.z) > c.r * 2.8 + 16); // keep the impact site clear
  return groundCraters;
};
// cw = crater weight (the far, coarser part of the terrain mesh uses softened craters)
export const groundHeight = (x: number, z: number, cw = 1) => {
  let y =
    1.6 * (fbm(x * 0.012 + 3, z * 0.012 + 9, 0.5, 4) - 0.5) +
    0.35 * (fbm(x * 0.08, z * 0.08, 2.5, 3) - 0.5);
  for (const c of getGroundCraters()) {
    let dx = x - c.x,
      dz = z - c.z;
    dx -= Math.round(dx / GROUND_SPAN) * GROUND_SPAN;
    dz -= Math.round(dz / GROUND_SPAN) * GROUND_SPAN;
    const d = Math.sqrt(dx * dx + dz * dz) / c.r;
    if (d < 2.7) y += cw * c.r * c.d * craterProfile(d, 0.5);
  }
  return y;
};

let regCache: { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } | null =
  null;
// fine detail texture (small pebbles / micro craters), tiled many times
export const getRegolithTextures = () => {
  if (regCache) return regCache;
  const W = 1024;
  const h = new Float32Array(W * W);
  const alb = new Float32Array(W * W);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const a = (x / W) * Math.PI * 2,
        b = (y / W) * Math.PI * 2;
      // torus-mapped noise -> seamless tiling
      const n = fbm(
        Math.cos(a) * 3 + 5,
        Math.sin(a) * 3 + Math.cos(b) * 3,
        Math.sin(b) * 3 + 1,
        5,
      );
      const n2 = vnoise(
        Math.cos(a) * 40,
        Math.sin(a) * 40 + Math.cos(b) * 40,
        Math.sin(b) * 40,
      );
      h[y * W + x] = n * 0.8 + n2 * 0.25;
      alb[y * W + x] = 0.55 + 0.25 * (n - 0.5) + 0.12 * (n2 - 0.5);
    }
  const r = rng(99);
  for (let k = 0; k < 900; k++) {
    const cx = r() * W,
      cy = r() * W,
      rad = 2 + 14 * Math.pow(r(), 4);
    const R = rad * 2.7;
    for (let y = Math.floor(cy - R); y < cy + R; y++)
      for (let x = Math.floor(cx - R); x < cx + R; x++) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d > 2.7) continue;
        const i = ((y + W) % W) * W + ((x + W) % W);
        h[i] += 0.08 * rad * 0.1 * craterProfile(d, 0.5);
      }
  }
  // pebbles
  for (let k = 0; k < 2500; k++) {
    const cx = r() * W,
      cy = r() * W,
      rad = 0.8 + 2.5 * r() * r();
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++)
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d > 1) continue;
        const i = ((y + W) % W) * W + ((x + W) % W);
        h[i] += 0.12 * Math.sqrt(1 - d * d);
        alb[i] += 0.05;
      }
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = W;
  const g = c.getContext("2d")!;
  const img = g.createImageData(W, W);
  for (let i = 0; i < W * W; i++) {
    const a = Math.max(0, Math.min(1, alb[i] + 0.05 * (hash3(i, 1, 9) - 0.5)));
    img.data[i * 4] = a * 228;
    img.data[i * 4 + 1] = a * 228;
    img.data[i * 4 + 2] = a * 228;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const map = toCanvasTex(c, true);
  const normal = heightToNormal(h, W, W, 14, false, true);
  for (const t of [map, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  regCache = { map, normal };
  return regCache;
};

// ---------------------------------------------------------------------------
// Rocket stage skin: white panels, dark-grey bands and details (no logos)
// u = around the body, v = along it (0 = engine end, 1 = top)
// ---------------------------------------------------------------------------
const skinCache = new Map<string, THREE.CanvasTexture>();
export const getStageSkin = (variant: "modern" | "apollo") => {
  const hit = skinCache.get(variant);
  if (hit) return hit;
  const W = 1024,
    H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const r = rng(variant === "modern" ? 5 : 6);
  g.fillStyle = variant === "modern" ? "#eceef0" : "#e9e6dc";
  g.fillRect(0, 0, W, H);
  // subtle panel tone variation
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "150,155,160"},${0.04 + 0.05 * r()})`;
    g.fillRect((i / 16) * W, 0, W / 16, H);
  }
  // panel seams
  g.strokeStyle = "rgba(90,95,100,0.35)";
  g.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    g.beginPath();
    g.moveTo((i / 16) * W, 0);
    g.lineTo((i / 16) * W, H);
    g.stroke();
  }
  for (let j = 1; j < 8; j++) {
    g.beginPath();
    g.moveTo(0, (j / 8) * H);
    g.lineTo(W, (j / 8) * H);
    g.stroke();
  }
  const band = (v0: number, v1: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(0, H * (1 - v1), W, H * (v1 - v0));
  };
  if (variant === "modern") {
    band(0.0, 0.06, "#3a3e44"); // aft skirt
    band(0.48, 0.5, "#50555c"); // tank dome joint
    band(0.92, 1.0, "#2f3338"); // forward ring
    // cable raceways along the body
    for (const u of [0.22, 0.72]) {
      g.fillStyle = "#3d4248";
      g.fillRect(u * W - 10, H * 0.02, 20, H * 0.94);
      g.fillStyle = "rgba(255,255,255,0.15)";
      g.fillRect(u * W - 10, H * 0.02, 4, H * 0.94);
    }
    // small access hatches
    g.fillStyle = "#4a4f56";
    for (let k = 0; k < 8; k++)
      g.fillRect(r() * W, H * (0.1 + 0.8 * r()), 26 + 30 * r(), 18 + 20 * r());
  } else {
    // Apollo-era roll pattern: black quarters near the aft end + forward ring
    band(0.0, 0.08, "#1d1d1d");
    band(0.9, 1.0, "#d9d6cc");
    g.fillStyle = "#1d1d1d";
    for (const u of [0, 0.5])
      g.fillRect(u * W, H * (1 - 0.32), W * 0.25, H * 0.24);
    band(0.94, 0.97, "#1d1d1d");
  }
  // soot / weathering towards the engine end
  const gr = g.createLinearGradient(0, H, 0, H * 0.75);
  gr.addColorStop(0, "rgba(40,36,32,0.45)");
  gr.addColorStop(1, "rgba(40,36,32,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  const t = toCanvasTex(c, true);
  t.wrapS = THREE.RepeatWrapping;
  skinCache.set(variant, t);
  return t;
};

// soft round sprite (dust / glow)
const spriteCache = new Map<string, THREE.CanvasTexture>();
export const getSoftSprite = (kind: "dot" | "puff" | "glow") => {
  const hit = spriteCache.get(kind);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  if (kind === "puff") {
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      const x = S / 2 + (r() - 0.5) * S * 0.45,
        y = S / 2 + (r() - 0.5) * S * 0.45,
        rad = S * (0.12 + 0.18 * r());
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(255,255,255,0.22)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
  } else {
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    if (kind === "dot") {
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.45, "rgba(255,255,255,0.7)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.08, "rgba(255,255,255,0.8)");
      gr.addColorStop(0.25, "rgba(255,255,255,0.18)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
    }
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  const t = toCanvasTex(c, false);
  spriteCache.set(kind, t);
  return t;
};

// red "empty fuel tank" icon (scene 3), no text
let fuelCache: THREE.CanvasTexture | null = null;
export const getFuelIcon = () => {
  if (fuelCache) return fuelCache;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ff3b30";
  g.fillStyle = "#ff3b30";
  g.lineWidth = 16;
  g.lineJoin = "round";
  // jerrycan body
  g.beginPath();
  g.moveTo(70, 60);
  g.lineTo(170, 60);
  g.lineTo(200, 92);
  g.lineTo(200, 216);
  g.lineTo(56, 216);
  g.lineTo(56, 104);
  g.closePath();
  g.stroke();
  // spout + handle
  g.beginPath();
  g.moveTo(70, 60);
  g.lineTo(44, 34);
  g.stroke();
  g.strokeRect(110, 74, 54, 16);
  // empty level: only a thin sliver at the bottom
  g.fillRect(70, 196, 116, 8);
  // "empty" slash
  g.lineWidth = 18;
  g.beginPath();
  g.moveTo(40, 232);
  g.lineTo(220, 40);
  g.stroke();
  fuelCache = toCanvasTex(c, true);
  return fuelCache;
};

// environment map: black space, a hard white sun and a faint moon glow (reflections on metal)
export const makeSpaceEnv = (sunDir: THREE.Vector3) => {
  const W = 512,
    H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#020306";
  g.fillRect(0, 0, W, H);
  // equirect position of a direction (three.js convention)
  const pos = (d: THREE.Vector3) => {
    const u = 0.5 + Math.atan2(d.x, -d.z) / (2 * Math.PI);
    const v = 0.5 - Math.asin(d.y) / Math.PI;
    return [u * W, v * H] as const;
  };
  const [sx, sy] = pos(sunDir.clone().normalize());
  for (const [rad, col] of [
    [60, "rgba(255,200,150,0.25)"],
    [18, "rgba(255,240,220,0.9)"],
    [7, "rgba(255,255,255,1)"],
  ] as const) {
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
    gr.addColorStop(0, col);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  // cool fill from the opposite side
  const [mx, my] = pos(sunDir.clone().multiplyScalar(-1).normalize());
  const gr = g.createRadialGradient(mx, my, 0, mx, my, 120);
  gr.addColorStop(0, "rgba(60,90,150,0.35)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
