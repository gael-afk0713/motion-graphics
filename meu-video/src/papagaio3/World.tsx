// "Peixe-papagaio – parte 3/3": the new look of the world (aesthetic review of v5). Only environment, light and
// scenery materials: the fish model (Fish.tsx / gfx.ts) is untouched; it only gets lit differently.
//   * depth: deep water all round the camera with a matched fog (colour goes to a darker, more saturated blue
//     with distance), 4 soft volumetric light shafts (opacity <= 0.12, slow), plankton in 2 speed layers;
//   * floor: sand with ripples and tone variation (world-space, seamless), slow caustics, shells, seagrass tufts,
//     branching coral, rocks with varied shapes and a rock/coral texture (no smooth bubbles);
//   * palette: one dominant blue-green + one warm accent (coral / orange); no loose pastels;
//   * the fish: a blue-green rim light from behind, a soft specular key from the camera side, a warm bounce
//     from the sand under the belly;
//   * the island scenes (2 and 8): the same palette and light, seen from the water level.
import React, { useMemo } from "react";
import * as THREE from "three";
import { alphaPoints, causticMaterial, fbm3, memo, rng, softSprite, V } from "../papagaio/gfx";
import { islandGeo, palmGeo } from "../papagaio/Island";
import { Coral, ReefEnv } from "../papagaio/Reef";

// ---------------------------------------------------------------------------
// Palette (sRGB): one blue-green, one warm accent
// ---------------------------------------------------------------------------
export const PAL = {
  waterTop: "#3d9fb2", // towards the surface
  waterMid: "#126a86", // eye level, at a distance (= fog)
  waterLow: "#0a4560", // below eye level, far away
  deadMid: "#2f7487", // the lagoon of scene 3: paler, greyer
  sand: "#cdb98f",
  sandDark: "#a8936a",
  warm: ["#e8673c", "#f07f45", "#d9583b", "#ee8a5c"], // coral / orange accent
  grass: "#2f7a55",
  grassDark: "#1d5a3f",
};

// ---------------------------------------------------------------------------
// Deep water (no sky, no horizon) + matched fog
// ---------------------------------------------------------------------------
const deepMat = (top: string, mid: string, low: string) =>
  memo(`p3deep_${top}${mid}${low}`, () => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color(top) }, uMid: { value: new THREE.Color(mid) }, uLow: { value: new THREE.Color(low) } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; varying vec3 vP;
        void main(){ float y = normalize(vP).y;
          vec3 c = y > 0.0 ? mix(uMid, uTop, pow(smoothstep(0.0, 0.9, y), 0.9)) : mix(uMid, uLow, smoothstep(0.0, -0.35, y));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      fog: false,
    });
    return m;
  });
export const DeepWater: React.FC<{ cam: THREE.Vector3; dead?: boolean; density?: number }> = ({ cam, dead = false, density = 0.05 }) => {
  const mid = dead ? PAL.deadMid : PAL.waterMid;
  return (
    <>
      <fogExp2 attach="fog" args={[mid, density]} />
      {/* it writes depth, so the old bright dome of ReefEnv (radius 150, behind it) never shows */}
      <mesh material={deepMat(dead ? "#5aa6b2" : PAL.waterTop, mid, PAL.waterLow)} position={cam}>
        <sphereGeometry args={[110, 32, 20]} />
      </mesh>
    </>
  );
};

// ---------------------------------------------------------------------------
// 4 soft light shafts from above (additive, opacity <= 0.12, slow)
// ---------------------------------------------------------------------------
const shaftTex = () =>
  memo("p3shaft", () => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d")!;
    const gx = g.createLinearGradient(0, 0, 64, 0);
    gx.addColorStop(0, "rgba(255,255,255,0)");
    gx.addColorStop(0.5, "rgba(255,255,255,1)");
    gx.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gx;
    g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = "destination-in";
    const gy = g.createLinearGradient(0, 0, 0, 256);
    gy.addColorStop(0, "rgba(0,0,0,1)");
    gy.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gy;
    g.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    return t;
  });
export const LightShafts: React.FC<{ t: number; cam: THREE.Vector3; strength?: number; hero?: number }> = ({ t, cam, strength = 1, hero = 0 }) => {
  const shafts = useMemo(() => {
    const r = rng(71);
    return Array.from({ length: 4 }, (_, i) => ({ x: -4.5 + i * 3 + r() * 1.2, z: -3 - r() * 4, w: 1.6 + r() * 1.6, ph: r() * 6.28, a: 0.08 + r() * 0.04 }));
  }, []);
  return (
    <group>
      {hero > 0 && (
        <mesh position={[cam.x + 0.6 + 0.25 * Math.sin(t * 0.12), 6.0, -2.2]} rotation={[0, 0, 0.22 + 0.02 * Math.sin(t * 0.17)]} renderOrder={5}>
          <planeGeometry args={[2.6, 16]} />
          <meshBasicMaterial map={shaftTex()} color="#f4fff2" transparent opacity={Math.min(0.15, 0.15 * hero * (0.85 + 0.15 * Math.sin(t * 0.35)))} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {shafts.map((s, i) => (
        <mesh key={i} position={[cam.x + s.x + 0.4 * Math.sin(t * 0.15 + s.ph), 6.5, s.z]} rotation={[0, 0, 0.28 + 0.03 * Math.sin(t * 0.2 + s.ph)]} renderOrder={5}>
          <planeGeometry args={[s.w, 16]} />
          <meshBasicMaterial map={shaftTex()} color="#e8fff6" transparent opacity={Math.min(0.12, s.a * strength * (0.75 + 0.25 * Math.sin(t * 0.4 + s.ph)))} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Plankton: 2 layers (near: bigger, faster; far: tiny, slow)
// ---------------------------------------------------------------------------
export const Plankton: React.FC<{ t: number; cam: THREE.Vector3 }> = ({ t, cam }) => {
  const layers = useMemo(() => {
    const mk = (n: number, seed: number, spread: number) => {
      const r = rng(seed);
      const g = new THREE.BufferGeometry();
      const base = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        base[i * 3] = (r() - 0.5) * spread;
        base[i * 3 + 1] = r() * 7 - 1;
        base[i * 3 + 2] = (r() - 0.5) * spread * 0.6;
      }
      g.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
      g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
      return { g, base, n };
    };
    return {
      near: { ...mk(160, 5, 10), m: alphaPoints({ map: softSprite(), size: 0.07, color: "#f2fff8", opacity: 0.55, fog: false }), v: 0.18 },
      far: { ...mk(520, 9, 30), m: alphaPoints({ map: softSprite(), size: 0.035, color: "#cfefe9", opacity: 0.5 }), v: 0.05 },
    };
  }, []);
  for (const L of [layers.near, layers.far]) {
    const p = L.g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < L.n; i++) {
      const bx = L.base[i * 3];
      const by = L.base[i * 3 + 1];
      const bz = L.base[i * 3 + 2];
      p.setXYZ(i, bx + 0.3 * Math.sin(t * L.v * 3 + i), by + ((t * L.v * 0.6 + i * 0.37) % 1.5) - 0.75 + 0.15 * Math.sin(t * 0.7 + i * 1.3), bz);
    }
    p.needsUpdate = true;
  }
  return (
    <group>
      <points geometry={layers.far.g} material={layers.far.m} position={[Math.round(cam.x / 10) * 10, 0, cam.z - 9]} frustumCulled={false} renderOrder={6} />
      <points geometry={layers.near.g} material={layers.near.m} position={[cam.x, 0, cam.z - 3.5]} frustumCulled={false} renderOrder={7} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Sea floor: world-space ripples and dunes (seamless when it follows the camera), tone variation, caustics
// ---------------------------------------------------------------------------
export const floorY = (x: number, z: number) =>
  0.18 * (fbm3(x * 0.07, 0, z * 0.07, 3) - 0.5) + 0.045 * Math.sin(x * 3.1 + 1.8 * fbm3(x * 0.4, 1, z * 0.4, 2) + z * 0.45) * (0.6 + 0.4 * fbm3(x * 0.2, 2, z * 0.2, 2));
const sandTex = (dead: boolean) =>
  memo("p3sandTex" + dead, () => {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const r = rng(dead ? 4 : 3);
    g.fillStyle = dead ? "#c3b597" : PAL.sand;
    g.fillRect(0, 0, S, S);
    // large soft tone patches (darker / greener / warmer), wrapped so the texture tiles
    for (let i = 0; i < 70; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = 30 + r() * 90;
      const col = [dead ? "rgba(120,118,108,0.16)" : "rgba(150,128,90,0.16)", "rgba(95,120,95,0.10)", "rgba(230,214,176,0.18)"][Math.floor(r() * 3)];
      for (const dx of [-S, 0, S])
        for (const dy of [-S, 0, S]) {
          const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
          gr.addColorStop(0, col);
          gr.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gr;
          g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
        }
    }
    // fine grains
    const img = g.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 22;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n * 0.8;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  });
const floorGeo = (cx: number) =>
  memo("p3floor" + cx, () => {
    const W = 90;
    const D = 46;
    const g = new THREE.PlaneGeometry(W, D, 300, 150);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + cx;
      const z = p.getZ(i) - 8;
      p.setY(i, floorY(x, z));
      uv.setXY(i, x * 0.12, z * 0.12); // world-space UV: the texture never jumps
    }
    g.computeVertexNormals();
    return g;
  });
const floorMat = (dead: boolean) => memo("p3floorMat" + dead, () => causticMaterial({ map: sandTex(dead), roughness: 1 }, dead ? 0.9 : 1.4, 0.14));
export const Seabed: React.FC<{ cam: THREE.Vector3; dead?: boolean }> = ({ cam, dead = false }) => {
  const cx = Math.round(cam.x / 30) * 30;
  return <mesh geometry={floorGeo(cx)} material={floorMat(dead)} position={[cx, 0, -8]} />;
};

// ---------------------------------------------------------------------------
// Rocks with varied shapes and a rock / coral-rock texture (with small pink coralline patches: warm accent)
// ---------------------------------------------------------------------------
const rockTex = (dead = false) =>
  memo("p3rockTex" + dead, () => {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const r = rng(13);
    g.fillStyle = dead ? "#bdb8ae" : "#8f877a";
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const v = (dead ? 150 : 95) + Math.floor(r() * 80);
      g.fillStyle = `rgba(${v},${v - 6},${v - 16},0.45)`;
      g.beginPath();
      g.arc(r() * S, r() * S, 2 + r() * 10, 0, Math.PI * 2);
      g.fill();
    }
    // pores / cups of old coral rock
    for (let i = 0; i < 500; i++) {
      g.fillStyle = "rgba(55,50,44,0.55)";
      g.beginPath();
      g.arc(r() * S, r() * S, 1.5 + r() * 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // coralline algae (pinkish crust) and a little green turf; none on the dead lagoon rock
    for (let i = 0; i < (dead ? 0 : 45); i++) {
      g.fillStyle = r() > 0.4 ? "rgba(214,120,112,0.55)" : "rgba(80,118,72,0.45)";
      g.beginPath();
      g.ellipse(r() * S, r() * S, 8 + r() * 26, 5 + r() * 16, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  });
const rockBump = (dead = false) =>
  memo("p3rockBump" + dead, () => {
    const t = rockTex(dead).clone();
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  });
export const rockGeo3 = (seed: number) =>
  memo("p3rock" + seed, () => {
    const r = rng(seed * 7 + 1);
    const g = new THREE.IcosahedronGeometry(1, 5);
    const p = g.attributes.position;
    const sx = 0.7 + r() * 0.8;
    const sy = 0.45 + r() * 0.5;
    const sz = 0.6 + r() * 0.7;
    const o = r() * 50;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const big = fbm3(v.x * 1.2 + o, v.y * 1.2, v.z * 1.2, 3) - 0.5;
      const mid = fbm3(v.x * 3.3 + o, v.y * 3.3, v.z * 3.3, 3) - 0.5;
      const ridge = Math.abs(fbm3(v.x * 2.2, v.y * 2.2 + o, v.z * 2.2, 2) - 0.5);
      const k = 1 + 0.75 * big + 0.28 * mid - 0.22 * ridge;
      let y = v.y * k * sy;
      if (y < -0.25 * sy) y = -0.25 * sy + (y + 0.25 * sy) * 0.15; // flat bottom, sitting on the sand
      p.setXYZ(i, v.x * k * sx, y, v.z * k * sz);
    }
    g.computeVertexNormals();
    return g;
  });
const rockMat3 = (dead = false) =>
  memo("p3rockMat" + dead, () => causticMaterial({ map: rockTex(dead), bumpMap: rockBump(dead), bumpScale: 3, roughness: 0.95, color: dead ? "#e4e0d8" : "#d2cabd" }, 0.7));
export const Rock3: React.FC<{ seed: number; position: THREE.Vector3; scale: number; rot?: number; dead?: boolean; onFloor?: boolean }> = ({ seed, position, scale, rot = 0, dead = false, onFloor = true }) => (
  <mesh geometry={rockGeo3(seed % 9)} material={rockMat3(dead)} position={[position.x, onFloor ? floorY(position.x, position.z) + 0.05 * scale : position.y, position.z]} rotation={[0, rot, 0]} scale={scale} castShadow receiveShadow />
);

// ---------------------------------------------------------------------------
// Shells, seagrass, branching coral
// ---------------------------------------------------------------------------
const shellGeo = (kind: number) =>
  memo("p3shell" + kind, () => {
    if (kind === 0) {
      // a fan (scallop): half disc with ridges
      const g = new THREE.CircleGeometry(1, 24, 0, Math.PI);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getY(i), p.getX(i));
        const rr = Math.hypot(p.getX(i), p.getY(i));
        p.setZ(i, 0.12 * Math.sin(a * 14) * rr + 0.25 * rr * (1 - rr));
      }
      g.computeVertexNormals();
      g.rotateX(-Math.PI / 2.4);
      return g;
    }
    const g = new THREE.ConeGeometry(0.5, 1.6, 10, 6);
    g.rotateZ(Math.PI / 2.2);
    return g;
  });
const shellMat = (col: string) => memo("p3shellMat" + col, () => new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }));
const bladeGeo = () =>
  memo("p3blade", () => {
    const g = new THREE.PlaneGeometry(0.035, 1, 1, 8);
    g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) * (1 - 0.6 * y) + 0.12 * y * y); // tapering, curving over
    }
    g.computeVertexNormals();
    return g;
  });
const grassMat = (dark: boolean) => memo("p3grass" + dark, () => new THREE.MeshStandardMaterial({ color: dark ? PAL.grassDark : PAL.grass, roughness: 0.7, side: THREE.DoubleSide }));
const Tuft: React.FC<{ p: THREE.Vector3; seed: number; t: number; h: number }> = ({ p, seed, t, h }) => {
  const blades = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: 9 }, () => ({ x: (r() - 0.5) * 0.25, z: (r() - 0.5) * 0.25, ry: r() * 6.28, h: 0.6 + r() * 0.6, ph: r() * 6.28, dark: r() > 0.5 }));
  }, [seed]);
  return (
    <group position={[p.x, floorY(p.x, p.z) - 0.02, p.z]} scale={h}>
      {blades.map((b, i) => (
        <mesh key={i} geometry={bladeGeo()} material={grassMat(b.dark)} position={[b.x, 0, b.z]} rotation={[0.18 * Math.sin(t * 1.1 + b.ph), b.ry, 0.15 * Math.sin(t * 0.9 + b.ph + 1)]} scale={[1, b.h, 1]} />
      ))}
    </group>
  );
};

type Item = { kind: number; x: number; z: number; s: number; rot: number; color: string; seed: number };
// brain corals get their tone from the colour string's hash in Reef.tsx: keep only the natural ones
// (beige / mustard / olive), never the lilac one
const BRAIN_OK = ["#d8c29b", "#c7a447", "#8f9a5c", "#d6b98a", "#b8a060", "#9aa36a", "#caa86e", "#a9b07c"].filter((c) => (c.charCodeAt(1) + c.charCodeAt(3) + c.charCodeAt(5)) % 4 !== 3);
/** scenery around a stretch of x: corals in the palette (warm accent + natural brain tones), rocks, shells,
 *  seagrass. dead = the lagoon of scene 3: white-grey dead coral, rocks and shells, no live coral, no grass. */
export const Scenery: React.FC<{ x: number; t: number; range?: number; dead?: boolean; clear?: (x: number, z: number) => boolean; seed?: number }> = ({ x, t, range = 16, dead = false, clear, seed = 1 }) => {
  const all = useMemo(() => {
    const r = rng(seed * 97 + (dead ? 5 : 0));
    const corals: Item[] = [];
    const rocks: { p: THREE.Vector3; s: number; seed: number; rot: number }[] = [];
    const shells: { p: THREE.Vector3; kind: number; s: number; rot: number; col: string }[] = [];
    const tufts: { p: THREE.Vector3; seed: number; h: number }[] = [];
    for (let xx = -70; xx <= 230; xx += 1.15) {
      const z = -1.6 - r() * 5.5;
      const roll = r();
      if (dead) {
        if (roll < 0.5) corals.push({ kind: r() > 0.4 ? 2 : 3, x: xx + r() * 0.6, z, s: 0.4 + r() * 0.45, rot: r() * 6.28, color: ["#d6d2ca", "#c9c4bb", "#e2ded6"][Math.floor(r() * 3)], seed: 1 + Math.floor(r() * 3) });
      } else if (roll < 0.28) corals.push({ kind: 1, x: xx + r() * 0.6, z, s: 0.45 + r() * 0.45, rot: r() * 6.28, color: BRAIN_OK[Math.floor(r() * BRAIN_OK.length)], seed: 1 + Math.floor(r() * 3) });
      else if (roll < 0.6) corals.push({ kind: 2, x: xx + r() * 0.6, z, s: 0.4 + r() * 0.45, rot: r() * 6.28, color: PAL.warm[Math.floor(r() * 4)], seed: 1 + Math.floor(r() * 3) });
      else if (roll < 0.72) corals.push({ kind: 3, x: xx + r() * 0.6, z, s: 0.45 + r() * 0.4, rot: r() * 6.28, color: PAL.warm[Math.floor(r() * 4)], seed: 1 + Math.floor(r() * 3) });
      else if (roll < 0.8) corals.push({ kind: 4, x: xx + r() * 0.6, z, s: 0.35 + r() * 0.35, rot: r() * 6.28, color: "#2f8a86", seed: 1 + Math.floor(r() * 3) });
      if (r() < 0.35) rocks.push({ p: V(xx + r(), 0, -1.4 - r() * 5), s: 0.35 + r() * 0.55, seed: Math.floor(r() * 9), rot: r() * 6.28 });
      // the near floor (between the fish and the camera) is not left empty
      if (r() < 0.4) rocks.push({ p: V(xx + r(), 0, 1.6 + r() * 2.8), s: 0.16 + r() * 0.28, seed: Math.floor(r() * 9), rot: r() * 6.28 });
      for (let k = 0; k < 2; k++) if (r() < 0.6) shells.push({ p: V(xx + r(), 0, -1 + r() * 5.5), kind: r() > 0.55 ? 0 : 1, s: 0.05 + r() * 0.06, rot: r() * 6.28, col: ["#efe1c8", "#e9b79c", "#f0c9a8", "#d9cdb5"][Math.floor(r() * 4)] });
      if (!dead && r() < 0.45) tufts.push({ p: V(xx + r(), 0, -1.2 - r() * 4), seed: Math.floor(r() * 1000), h: 0.35 + r() * 0.45 });
      if (!dead && r() < 0.6) tufts.push({ p: V(xx + r(), 0, 1.6 + r() * 3.0), seed: Math.floor(r() * 1000), h: 0.3 + r() * 0.4 });
      if (dead && r() < 0.35) corals.push({ kind: 2, x: xx + r(), z: 1.7 + r() * 2.5, s: 0.22 + r() * 0.2, rot: r() * 6.28, color: "#d2cec6", seed: 1 + Math.floor(r() * 3) });
    }
    return { corals, rocks, shells, tufts };
  }, [dead, seed]);
  const near = (px: number, pz: number) => Math.abs(px - x) < range && !(clear && clear(px, pz));
  return (
    <group>
      {all.corals.filter((c) => near(c.x, c.z)).map((c, i) => (
        <group key={`c${c.x.toFixed(2)}_${i}`} position={[0, floorY(c.x, c.z) - 0.03, 0]}>
          <Coral item={c} />
        </group>
      ))}
      {all.rocks.filter((k) => near(k.p.x, k.p.z)).map((k, i) => (
        <Rock3 key={`r${i}`} seed={k.seed} position={k.p} scale={k.s} rot={k.rot} dead={dead} />
      ))}
      {all.shells.filter((s) => near(s.p.x, s.p.z)).map((s, i) => (
        <mesh key={`s${i}`} geometry={shellGeo(s.kind)} material={shellMat(s.col)} position={[s.p.x, floorY(s.p.x, s.p.z) + 0.02, s.p.z]} rotation={[0, s.rot, 0]} scale={s.s} />
      ))}
      {all.tufts.filter((g) => near(g.p.x, g.p.z)).map((g, i) => (
        <Tuft key={`g${i}`} p={g.p} seed={g.seed} t={t} h={g.h} />
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Everything underwater in one: lights from ReefEnv (its floor, rays and dome are replaced), deep water,
// fog, shafts, plankton, the sea floor
// ---------------------------------------------------------------------------
export const Underwater: React.FC<{ t: number; cam: THREE.Vector3; dead?: boolean; dim?: number; shafts?: number; fog?: number; hero?: number }> = ({ t, cam, dead = false, dim = 0, shafts = 1, fog, hero = 0 }) => (
  <>
    <ReefEnv t={t} cam={cam} dim={dim} floor={false} rays={0} />
    <DeepWater cam={cam} dead={dead} density={fog ?? (dead ? 0.055 : 0.05)} />
    <LightShafts t={t} cam={cam} strength={shafts} hero={hero} />
    <Plankton t={t} cam={cam} />
    <Seabed cam={cam} dead={dead} />
  </>
);

// ---------------------------------------------------------------------------
// Light on the fish (no change to its model or material): blue-green rim from behind, a soft specular key
// from the camera side, warm bounce from the sand under the belly
// ---------------------------------------------------------------------------
export const FishLights: React.FC<{ fish: THREE.Vector3; cam: THREE.Vector3; rim?: number }> = ({ fish, cam, rim = 1 }) => {
  const away = fish.clone().sub(cam).setY(0).normalize();
  return (
    <>
      <pointLight position={fish.clone().addScaledVector(away, 2.2).add(V(0, 1.4, 0))} color="#5fe8cf" intensity={9 * rim} distance={6} decay={2} />
      <pointLight position={cam.clone().lerp(fish, 0.35).add(V(0.6, 2.2, 0))} color="#fff6e6" intensity={6} distance={12} decay={2} />
      <pointLight position={fish.clone().add(V(0.2, -1.1, 0.8))} color="#ffd9a8" intensity={2.4} distance={3} decay={2} />
      <pointLight position={fish.clone().add(V(-0.3, 1.5, -0.2))} color="#7fbfae" intensity={2.6} distance={2.6} decay={2} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Island scenes (2 and 8): seen from the water level, same palette and light as the sea floor
// ---------------------------------------------------------------------------
const skyMat3 = () =>
  memo("p3sky", () =>
    new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color("#2b77a8") }, uHor: { value: new THREE.Color("#a3d4d6") } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP; void main(){ float y = normalize(vP).y;
        vec3 c = mix(uHor, uTop, pow(smoothstep(-0.02, 0.6, y), 0.7));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
const seaMat3 = () =>
  memo("p3sea", () =>
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIsle: { value: new THREE.Vector3() }, uCool: { value: 0 }, uR: { value: new THREE.Vector2(1.47, 1.27) }, uA0: { value: 0.45 } },
      vertexShader: /* glsl */ `
        uniform float uTime; varying vec3 vW; varying float vH;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          float h = 0.045 * sin(w.x * 0.9 + uTime * 1.3) + 0.035 * sin(w.z * 1.3 - uTime * 1.1) + 0.02 * sin((w.x + w.z) * 2.3 + uTime * 2.0);
          w.y += h; vH = h; vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uIsle; uniform float uCool; uniform vec2 uR; uniform float uA0; varying vec3 vW; varying float vH;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec3 N = normalize(cross(dFdx(vW), dFdy(vW))); if (N.y < 0.0) N = -N;
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          float d = length((vW - uIsle).xz);
          // shallow over the sand near the island, the dominant blue-green further out
          vec3 shallow = vec3(0.16, 0.50, 0.50);
          vec3 deep = vec3(0.03, 0.27, 0.36);
          vec3 col = mix(shallow, deep, smoothstep(2.5, 9.0, d));
          col = mix(col, vec3(0.42, 0.66, 0.72), fres * 0.35);
          float n = noise(vW.xz * 1.6 + uTime * 0.4) * 0.6 + noise(vW.xz * 3.7 - uTime * 0.5) * 0.4;
          col += vec3(0.05, 0.07, 0.07) * (n - 0.5);
          // a thin line of foam right on the beach (the island's waterline ellipse)
          float e = length((vW - uIsle).xz / uR);
          float ang = atan((vW - uIsle).z, (vW - uIsle).x);
          // the shore line, small waves lapping in towards the beach, patches of foam ("footprints") around it
          float shore = smoothstep(0.08, 0.0, abs(e - 1.03 - 0.035 * sin(uTime * 1.6 + ang * 5.0)));
          float lap = smoothstep(0.75, 1.0, sin(e * 28.0 - uTime * 2.6 + ang * 2.0)) * smoothstep(1.45, 1.05, e) * step(1.02, e);
          float patches = smoothstep(0.55, 0.8, noise(vec2(ang * 3.0, e * 6.0) + uTime * 0.15)) * smoothstep(0.35, 0.0, abs(e - 1.15));
          col = mix(col, vec3(0.86, 0.9, 0.88), clamp(shore * 0.7 + lap * 0.35 + patches * 0.55, 0.0, 0.85));
          float glint = pow(noise(vW.xz * 4.0 + uTime * 1.2), 14.0);
          col += glint * 0.55;
          col = mix(col, vec3(dot(col, vec3(0.33))), uCool * 0.45) * (1.0 - 0.12 * uCool);
          // clear water only in the band near the camera where the fish swims (it keeps its colours); further away the
          // water turns opaque, so the submerged slope and the edges of the floor never show through as a pale cone
          float dc = length(cameraPosition - vW);
          float a = clamp(uA0 + 0.75 * smoothstep(8.6, 10.6, dc) + fres * 0.2, uA0, 0.94);
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
const trunkTex = () =>
  memo("p3trunk", () => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#7d5e40";
    g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 9) {
      g.fillStyle = "rgba(50,34,20,0.55)";
      g.fillRect(0, y, 64, 3);
      g.fillStyle = "rgba(160,128,92,0.35)";
      g.fillRect(0, y + 3, 64, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 3);
    return t;
  });
/** anything under the water line (world y < 0) takes the water's blue-green and gets darker with depth, so the
 *  submerged sand never looks like it is lit in the open air */
const underwater = <M extends THREE.Material>(m: M, key: string): M => {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
varying float vUwY;`)
      .replace("#include <project_vertex>", `#include <project_vertex>
vUwY = (modelMatrix * vec4(transformed, 1.0)).y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying float vUwY;`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float kUw = smoothstep(0.03, -1.3, vUwY);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.32, 0.36), kUw * 0.78) * (1.0 - 0.3 * kUw);
        }`,
      );
  };
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => prevKey() + "-uw-" + key;
  return m;
};
const islandMats = () =>
  memo("p3islandMats", () => ({
    sand: underwater(new THREE.MeshStandardMaterial({ color: "#a8996f", roughness: 1 }), "sand"), // peak luminance under ~90%
    wet: underwater(new THREE.MeshStandardMaterial({ color: "#a89670", roughness: 0.8 }), "wet"),
    floor: underwater(causticMaterial({ map: sandTex(false), roughness: 1, color: "#b9ad93" }, 1.0, 0.14), "floor"),
    trunk: new THREE.MeshStandardMaterial({ map: trunkTex(), roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#3a8f43", roughness: 0.6, side: THREE.DoubleSide, emissive: new THREE.Color("#0c2a10"), emissiveIntensity: 0.4 }),
    leafDark: new THREE.MeshStandardMaterial({ color: "#2a6f35", roughness: 0.6, side: THREE.DoubleSide }),
    nut: new THREE.MeshStandardMaterial({ color: "#5a4028", roughness: 0.7 }),
  }));
const Palm: React.FC<{ seed: number; t: number; scale: number; position: [number, number, number] }> = ({ seed, t, scale, position }) => {
  const g = palmGeo(seed);
  const m = islandMats();
  const sway = 0.035 * Math.sin(t * 1.4 + seed);
  return (
    <group position={position} scale={scale} rotation={[sway, 0, sway * 0.7]}>
      <mesh geometry={g.trunk} material={m.trunk} castShadow />
      {g.fronds.map((f, i) => (
        <mesh key={i} geometry={f} material={i % 2 ? m.leafDark : m.leaf} castShadow />
      ))}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[g.top.x + Math.cos(k * 2.1) * 0.16, g.top.y - 0.16, g.top.z + Math.sin(k * 2.1) * 0.16]} material={m.nut} castShadow>
          <sphereGeometry args={[0.13, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
};
/** the little island seen from the water level: gradient sky, light waves, sand without blown-out white,
 *  palms with volume and a real shadow on the sand */
export const IslandSet: React.FC<{
  t: number;
  isle: THREE.Vector3;
  size?: number;
  /** height of the sand mound from its base (isle.y) */
  height?: number;
  palms?: { seed: number; at: [number, number]; s: number }[];
  cool?: number;
  /** water opacity right in front of the camera (lower = clearer, the fish under it keeps its colours) */
  clear?: number;
  /** small rocks on the shore */
  rocks?: boolean;
  /** sun direction (from the island), so the palm's shadow falls on the visible sand */
  sun?: [number, number, number];
  children?: React.ReactNode;
}> = ({ t, isle, size = 1, height, palms = [{ seed: 1, at: [0.1, -0.1], s: 0.6 }], cool = 0, clear = 0.45, rocks = false, sun = [6, 12, 5], children }) => {
  const H = height ?? 2.35 * size;
  const sea = seaMat3();
  sea.uniforms.uTime.value = t;
  sea.uniforms.uIsle.value.copy(isle);
  sea.uniforms.uCool.value = cool;
  sea.uniforms.uA0.value = clear;
  // the island mesh (dome y = (1-k^2)^1.4, scaled to H, base at isle.y) meets the water (y = 0) at radius k
  const kW = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, Math.min(1, -isle.y / H)), 1 / 1.4)));
  sea.uniforms.uR.value.set(3.0 * size * kW, 2.6 * size * kW);
  const m = islandMats();
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.copy(isle);
  const top = isle.y + H;
  const shoreRocks = useMemo(() => {
    const r = rng(37);
    return Array.from({ length: 8 }, (_, i) => {
      const a = -0.4 + i * 0.75 + r() * 0.4;
      return { a, k: kW * (0.92 + r() * 0.16), s: 0.1 + r() * 0.12, seed: i };
    });
  }, [kW]);
  return (
    <group>
      <mesh material={skyMat3()}>
        <sphereGeometry args={[240, 32, 20]} />
      </mesh>
      <hemisphereLight args={["#d9f1ff", "#2f7f86", 1.3]} />
      <primitive object={target} />
      <directionalLight position={[isle.x + sun[0], isle.y + sun[1], isle.z + sun[2]]} target={target} intensity={1.5} color="#fff1d6" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0005} />
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
        <planeGeometry args={[200, 200]} />
      </mesh>
      <mesh geometry={islandGeo()} material={m.sand} scale={[3.0 * size, H, 2.6 * size]} position={isle} receiveShadow />
      {/* darker wet band at the waterline */}
      <mesh geometry={islandGeo()} material={m.wet} scale={[3.12 * size, H * 0.69, 2.72 * size]} position={isle.clone().add(V(0, 0.02, 0))} />
      {rocks &&
        shoreRocks.map((k, i) => (
          <Rock3 key={i} seed={k.seed} position={V(isle.x + Math.cos(k.a) * 3.0 * size * k.k, 0.02, isle.z + Math.sin(k.a) * 2.6 * size * k.k)} scale={k.s} rot={k.a * 3} onFloor={false} />
        ))}
      {palms.map((p, i) => (
        <Palm key={i} seed={p.seed} t={t} scale={p.s * size} position={[isle.x + p.at[0], top - 0.06, isle.z + p.at[1]]} />
      ))}
      {children}
      <mesh material={sea} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={20}>
        <planeGeometry args={[200, 200, 200, 200]} />
      </mesh>
    </group>
  );
};
