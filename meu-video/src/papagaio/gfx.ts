// Shared helpers for "Peixe-papagaio": seeded random, noise, canvas textures and
// the caustics patch for standard materials. Everything is procedural (no image files).
import * as THREE from "three";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const sat = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = sat((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const rng = (seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
};

const h3 = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
/** smooth 3D value noise, 0..1 */
export const noise3 = (x: number, y: number, z: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    l(
      l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u),
      l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u),
      v,
    ),
    w,
  );
};
export const fbm3 = (x: number, y: number, z: number, oct = 3) => {
  let a = 0.5;
  let s = 0;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x, y, z);
    n += a;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
    a *= 0.5;
  }
  return s / n;
};

const cache = new Map<string, unknown>();
export const memo = <T,>(key: string, make: () => T): T => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
};

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
};
const tex = (c: HTMLCanvasElement, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

/** soft round sprite (white, radial falloff) */
export const softSprite = () =>
  memo("soft", () => {
    const [c, g] = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.35, "rgba(255,255,255,0.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return tex(c);
  });

/** crisp bright grain (solid core, tiny halo) */
export const grainSprite = () =>
  memo("grain-sprite", () => {
    const [c, g] = canvas(32, 32);
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.42, "rgba(255,255,255,1)");
    gr.addColorStop(0.6, "rgba(255,255,255,0.25)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    return tex(c);
  });

/** bubble sprite: thin bright ring + highlight */
export const bubbleSprite = (letter = "") =>
  memo("bubble" + letter, () => {
    const [c, g] = canvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 30, 64, 64, 60);
    gr.addColorStop(0, "rgba(255,255,255,0.05)");
    gr.addColorStop(0.8, "rgba(220,250,255,0.35)");
    gr.addColorStop(0.93, "rgba(255,255,255,0.95)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.ellipse(44, 40, 12, 7, -0.7, 0, 7);
    g.fill();
    if (letter) {
      g.font = "900 78px Montserrat, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 10;
      g.strokeStyle = "#0b1c22";
      g.strokeText(letter, 64, 66);
      g.fillStyle = "#fff";
      g.fillText(letter, 64, 66);
    }
    return tex(c);
  });

/** light shaft: bright at the top, fading down, soft sides */
export const raySprite = () =>
  memo("ray", () => {
    const [c, g] = canvas(64, 256);
    const img = g.createImageData(64, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 64; x++) {
        const sx = Math.sin((Math.PI * x) / 63) ** 2;
        const sy = (1 - y / 255) ** 1.5 * smooth(0, 0.08, y / 255);
        const i = (y * 64 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = 255 * sx * sy;
      }
    g.putImageData(img, 0, 0);
    return tex(c);
  });

export type FishPalette = {
  back: string;
  side: string;
  belly: string;
  head: string;
  chin: string;
  edge: string;
};
// initial phase: discreet grey-brown back, reddish belly (the bright colours are kept for part 3)
export const INITIAL_PHASE: FishPalette = {
  back: "#6b615d",
  side: "#8c776d",
  belly: "#c9523f",
  head: "#84756f",
  chin: "#d06a55",
  edge: "#34221f",
};

const lerpHex = (a: string, b: string, t: number) =>
  "#" + new THREE.Color(a).lerp(new THREE.Color(b), sat(t)).getHexString();

/**
 * Body texture (u = snout -> tail, v = back -> belly, mirrored on both sides):
 * smooth head, then big overlapping scales with a darker rim. Returns colour + bump.
 */
export const fishSkin = (pal: FishPalette = INITIAL_PHASE, key = "initial") =>
  memo("skin" + key, () => {
    const W = 1024;
    const H = 512;
    const [c, g] = canvas(W, H);
    const [cb, gb] = canvas(W, H);
    const colAt = (v: number) =>
      v < 0.5 ? lerpHex(pal.back, pal.side, v / 0.5) : lerpHex(pal.side, pal.belly, (v - 0.5) / 0.32);
    // base: back -> belly
    for (let y = 0; y < H; y++) {
      g.fillStyle = colAt(y / H);
      g.fillRect(0, y, W, 1);
    }
    gb.fillStyle = "#808080";
    gb.fillRect(0, 0, W, H);
    // scales, painted tail -> head so each one overlaps the one behind it
    const r = rng(11);
    const cols = 15;
    const rows = 9;
    const x0 = 0.2 * W;
    const sw = (W - x0) / cols;
    const sh = H / rows;
    for (let ci = cols + 1; ci >= -1; ci--)
      for (let ri = -1; ri <= rows; ri++) {
        const cx = x0 + (ci + (ri % 2 ? 0.5 : 0)) * sw;
        const cy = (ri + 0.5) * sh;
        const v = cy / H;
        const jitter = (r() - 0.5) * 0.12;
        const base = colAt(v + jitter);
        const rx = sw * 0.78;
        const ry = sh * 0.66;
        const gr = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
        gr.addColorStop(0, lerpHex(base, "#ffffff", 0.16));
        gr.addColorStop(0.6, base);
        gr.addColorStop(1, lerpHex(base, pal.edge, 0.45));
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = pal.edge;
        g.globalAlpha = 0.7;
        g.lineWidth = 5;
        g.stroke();
        g.globalAlpha = 1;
        const gr2 = gb.createLinearGradient(cx - rx, 0, cx + rx, 0);
        gr2.addColorStop(0, "#6a6a6a");
        gr2.addColorStop(0.85, "#e6e6e6");
        gr2.addColorStop(1, "#ffffff");
        gb.fillStyle = gr2;
        gb.beginPath();
        gb.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        gb.fill();
        gb.strokeStyle = "#202020";
        gb.lineWidth = 5;
        gb.stroke();
      }
    // smooth head (no scales), blended into the body
    const hg = g.createLinearGradient(0, 0, x0 + sw * 1.2, 0);
    hg.addColorStop(0, "rgba(0,0,0,1)");
    hg.addColorStop(0.72, "rgba(0,0,0,1)");
    hg.addColorStop(1, "rgba(0,0,0,0)");
    const [ch, gh] = canvas(W, H);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      gh.fillStyle = v < 0.5 ? lerpHex(pal.back, pal.head, v / 0.5) : v < 0.58 ? pal.head : lerpHex(pal.head, pal.chin, (v - 0.58) / 0.3);
      gh.fillRect(0, y, W, 1);
    }
    // a few soft marks radiating from the eye, like the real fish
    gh.globalAlpha = 0.22;
    gh.strokeStyle = pal.chin;
    gh.lineWidth = 7;
    for (let k = 0; k < 5; k++) {
      gh.beginPath();
      gh.moveTo(0.19 * W, 0.3 * H);
      gh.quadraticCurveTo(0.12 * W, (0.34 + k * 0.07) * H, 0.03 * W, (0.4 + k * 0.1) * H);
      gh.stroke();
    }
    gh.globalAlpha = 1;
    gh.globalCompositeOperation = "destination-in";
    gh.fillStyle = hg;
    gh.fillRect(0, 0, W, H);
    g.drawImage(ch, 0, 0);
    const [chb, ghb] = canvas(W, H);
    ghb.fillStyle = "#808080";
    ghb.fillRect(0, 0, W, H);
    ghb.globalCompositeOperation = "destination-in";
    ghb.fillStyle = hg;
    ghb.fillRect(0, 0, W, H);
    gb.drawImage(chb, 0, 0);
    // lips: a lighter ring around the beak
    const lip = g.createLinearGradient(0, 0, 0.05 * W, 0);
    lip.addColorStop(0, lerpHex(pal.head, "#e8c8bc", 0.4));
    lip.addColorStop(1, "rgba(200,170,160,0)");
    g.fillStyle = lip;
    g.fillRect(0, 0, 0.05 * W, H);
    // fine grain
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 14;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    return { map: tex(c), bump: tex(cb, false) };
  });

/** beak plate: many small teeth fused into a mosaic, with the seam in the middle.
 *  tile = brighter version whose rows repeat vertically (x-ray, growing rows) */
export const beakTexture = (tile = false) =>
  memo("beakTex" + tile, () => {
    const W = 512;
    const H = 288;
    const [c, g] = canvas(W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, tile ? "#fffbe6" : "#f6f5dc"); // cutting edge
    gr.addColorStop(1, tile ? "#fffbe6" : "#dfe6c2"); // base: pale greenish cream
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const r = rng(5);
    const rows = 9;
    const th = H / rows;
    for (let ri = 0; ri < rows; ri++) {
      const tw = 512 / 22;
      for (let k = -1; k <= 22; k++) {
        const cx = (k + (ri % 2 ? 0.5 : 0)) * tw + (tile ? 0 : (r() - 0.5) * 3);
        const cy = (ri + 0.5) * th;
        const tg = g.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, tw * 0.62);
        tg.addColorStop(0, "rgba(255,255,250,0.95)");
        tg.addColorStop(0.75, tile ? "rgba(255,248,214,0.95)" : "rgba(240,242,214,0.9)");
        tg.addColorStop(1, tile ? "rgba(214,186,120,0.95)" : "rgba(196,200,160,0.9)");
        g.fillStyle = tg;
        g.beginPath();
        g.ellipse(cx, cy, tw * 0.47, th * 0.5, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = tile ? "rgba(120,90,40,0.75)" : "rgba(130,135,95,0.4)";
        g.lineWidth = tile ? 2.2 : 1.3;
        g.stroke();
      }
    }
    // middle seam
    g.strokeStyle = tile ? "rgba(60,45,20,0.9)" : "rgba(70,70,48,0.8)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2, H);
    g.stroke();
    const t = tex(c);
    if (tile) t.wrapT = THREE.RepeatWrapping;
    return t;
  });

/** fin membrane with rays (u along the fin, v = base -> edge) */
export const finTexture = (base = "#b9483a", edge = "#e8826a", ray = "#7c2a22") =>
  memo("fin" + base + edge, () => {
    const [c, g] = canvas(256, 128);
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, base);
    gr.addColorStop(1, edge);
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = ray;
    g.globalAlpha = 0.6;
    g.lineWidth = 3;
    for (let x = 6; x < 256; x += 15) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 128);
      g.stroke();
    }
    return tex(c);
  });

/** brain coral surface: irregular organic relief (smooth noise), no line pattern.
 *  Tileable around the dome (u wraps on a circle). */
export const brainTexture = () =>
  memo("brainNoise", () => {
    const N = 512;
    const [c, g] = canvas(N, N);
    const img = g.createImageData(N, N);
    const R = 2.2;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const a = (x / N) * Math.PI * 2;
        const cx = Math.cos(a) * R;
        const cz = Math.sin(a) * R;
        const v = (y / N) * 7;
        const big = fbm3(cx, v, cz, 4);
        const small = fbm3(cx * 4.1 + 9, v * 4.1, cz * 4.1, 2);
        const val = 205 + 50 * (0.65 * big + 0.35 * small - 0.5) * 2;
        const i = (y * N + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(150, Math.min(255, val));
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });

/** speckled grain for rocks, table corals and sand */
export const grainTexture = () =>
  memo("grain", () => {
    const N = 256;
    const [c, g] = canvas(N, N);
    const img = g.createImageData(N, N);
    const r = rng(77);
    for (let i = 0; i < N * N; i++) {
      const v = 190 + r() * 65;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = "rgba(255,255,255,0.5)";
    for (let k = 0; k < 500; k++) {
      g.beginPath();
      g.arc(r() * N, r() * N, 0.6 + r() * 1.6, 0, 7);
      g.fill();
    }
    g.fillStyle = "rgba(90,70,50,0.25)";
    for (let k = 0; k < 350; k++) {
      g.beginPath();
      g.arc(r() * N, r() * N, 0.6 + r() * 1.8, 0, 7);
      g.fill();
    }
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });

// ---------------------------------------------------------------------------
// Caustics: one shared clock/intensity, patched into MeshStandardMaterial
// ---------------------------------------------------------------------------
export const CAUSTIC = { time: { value: 0 }, strength: { value: 1 } };

const CAUSTIC_FN = /* glsl */ `
uniform float uCTime;
uniform float uCStrength;
varying vec3 vCWPos;
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.2831853, 6.2831853) - 250.0;
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
`;

/** standard material lit by moving caustics on its upward-facing parts */
export const causticMaterial = (params: THREE.MeshStandardMaterialParameters, gain = 1, scale = 0.16) => {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCTime = CAUSTIC.time;
    sh.uniforms.uCStrength = CAUSTIC.strength;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCWPos;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 cwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cwp = instanceMatrix * cwp;
        #endif
        vCWPos = (modelMatrix * cwp).xyz;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + CAUSTIC_FN)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float cz = caustic(vCWPos.xz * ${scale.toFixed(3)} + vCWPos.y * 0.05, uCTime);
          totalEmissiveRadiance += diffuseColor.rgb * vec3(0.95, 1.0, 0.92) * cz * uCStrength * ${gain.toFixed(2)} * smoothstep(-0.25, 0.7, wn.y);
        }`,
      );
  };
  m.customProgramCacheKey = () => `caustic-${gain}-${scale}`;
  return m;
};

/** rim-glow shell used for the "x-ray" look */
export const xrayMaterial = (color: string) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
        gl_FragColor = vec4(uColor * (0.5 + f), (0.015 + 0.9 * f) * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

/** fan / ribbon surface between a base line and an edge line (u along, v across) */
export const ribbon = (base: THREE.Vector3[], tip: THREE.Vector3[], rows = 4) => {
  const n = base.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= rows; j++) {
      const p = base[i].clone().lerp(tip[i], j / rows);
      pos.push(p.x, p.y, p.z);
      uv.push(i / (n - 1), j / rows);
    }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = a + rows + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** points with a per-particle alpha (attribute "aAlpha") */
export const alphaPoints = (params: THREE.PointsMaterialParameters) => {
  const m = new THREE.PointsMaterial({ ...params, transparent: true, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aAlpha; varying float vAlpha;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAlpha = aAlpha;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vAlpha;")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );");
  };
  m.customProgramCacheKey = () => "alphaPoints";
  return m;
};
