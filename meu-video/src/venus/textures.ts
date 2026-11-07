import * as THREE from "three";

// Procedural, deterministic textures (same output in every render tab).

const hash = (x: number, y: number, z: number) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffffff) / 0xffffff;
};

const smooth = (t: number) => t * t * (3 - 2 * t);

const valueNoise = (x: number, y: number, z: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const zf = smooth(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c000 = hash(xi, yi, zi);
  const c100 = hash(xi + 1, yi, zi);
  const c010 = hash(xi, yi + 1, zi);
  const c110 = hash(xi + 1, yi + 1, zi);
  const c001 = hash(xi, yi, zi + 1);
  const c101 = hash(xi + 1, yi, zi + 1);
  const c011 = hash(xi, yi + 1, zi + 1);
  const c111 = hash(xi + 1, yi + 1, zi + 1);
  return l(
    l(l(c000, c100, xf), l(c010, c110, xf), yf),
    l(l(c001, c101, xf), l(c011, c111, xf), yf),
    zf,
  );
};

const fbm = (x: number, y: number, z: number, octaves: number) => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
};

type Stop = [number, [number, number, number]];

const ramp = (stops: Stop[], t: number): [number, number, number] => {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return [
        c0[0] + (c1[0] - c0[0]) * k,
        c0[1] + (c1[1] - c0[1]) * k,
        c0[2] + (c1[2] - c0[2]) * k,
      ];
    }
  }
  return stops[stops.length - 1][1];
};

const VENUS_STOPS: Stop[] = [
  [0.0, [120, 62, 22]],
  [0.3, [176, 102, 40]],
  [0.5, [222, 152, 70]],
  [0.68, [240, 196, 116]],
  [0.85, [250, 224, 168]],
  [1.0, [255, 240, 205]],
];

const makeEquirect = (
  w: number,
  h: number,
  fn: (x: number, y: number, z: number, lat: number) => [number, number, number, number],
) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat);
    const sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      const x = cl * Math.cos(lon);
      const z = cl * Math.sin(lon);
      const [r, g, b, a] = fn(x, sl, z, lat);
      const o = (j * w + i) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

let cache: {
  surface: THREE.CanvasTexture;
  clouds: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
} | null = null;

export const getTextures = () => {
  if (cache) return cache;

  const surface = makeEquirect(1024, 512, (x, y, z, lat) => {
    // Domain-warped noise, stretched along longitude -> swirling cloud bands
    const wx = fbm(x * 2.2 + 11, y * 2.2, z * 2.2, 4);
    const wy = fbm(x * 2.2, y * 2.2 + 7, z * 2.2, 4);
    const n = fbm(
      x * 2.5 + wx * 2.2,
      y * 7.5 + wy * 2.2,
      z * 2.5 + wx * 1.6,
      5,
    );
    // Large "Y"/chevron band shape typical of Venus' upper clouds
    const band = 0.5 + 0.5 * Math.sin(lat * 7 + Math.abs(lat) * 4 + wx * 5);
    const t = Math.min(1, Math.max(0, n * 0.85 + band * 0.25 - 0.05));
    const [r, g, b] = ramp(VENUS_STOPS, t);
    return [r, g, b, 255];
  });

  const clouds = makeEquirect(1024, 512, (x, y, z) => {
    const w = fbm(x * 3 + 3, y * 3, z * 3, 3);
    const n = fbm(x * 3.5 + w * 2.5, y * 9 + w, z * 3.5, 5);
    const a = Math.max(0, Math.min(1, (n - 0.45) * 3.2));
    return [255, 236, 196, Math.round(a * 200)];
  });

  const gc = document.createElement("canvas");
  gc.width = 256;
  gc.height = 256;
  const g = gc.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,250,225,1)");
  grad.addColorStop(0.15, "rgba(255,226,140,0.85)");
  grad.addColorStop(0.4, "rgba(255,160,60,0.3)");
  grad.addColorStop(1, "rgba(255,120,30,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const glow = new THREE.CanvasTexture(gc);
  glow.colorSpace = THREE.SRGBColorSpace;

  cache = { surface, clouds, glow };
  return cache;
};

// Seeded PRNG for star fields
export const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
