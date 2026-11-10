// The protagonist: a stylised parrotfish (initial phase colours), fully procedural.
// Local axes: +x = snout, +y = up, z = sides. Body length ~2.3 units with the tail fin.
import React, { useMemo } from "react";
import * as THREE from "three";
import {
  beakTexture,
  causticMaterial,
  finTexture,
  fishSkin,
  FishPalette,
  INITIAL_PHASE,
  memo,
  ribbon,
  smooth,
  softSprite,
  V,
  xrayMaterial,
} from "./gfx";

// --- body profile (u = 0 snout .. 1 tail base): long oval, rounded forehead ---
const U = [0, 0.02, 0.06, 0.12, 0.2, 0.32, 0.45, 0.6, 0.75, 0.88, 0.95, 1];
const TOP = [0, 0.105, 0.2, 0.275, 0.315, 0.36, 0.37, 0.34, 0.26, 0.165, 0.125, 0.115];
const BOT = [0, 0.09, 0.16, 0.215, 0.262, 0.315, 0.33, 0.3, 0.225, 0.145, 0.115, 0.11];
const WID = [0, 0.105, 0.165, 0.2, 0.225, 0.245, 0.24, 0.2, 0.14, 0.08, 0.055, 0.045];
const X0 = 1.0;
const X1 = -0.85;
const U_LIP = 0.022; // the skin starts at the lips: the beak sits inside this ring
const cr = (ys: number[], u: number) => {
  let k = 0;
  while (k < U.length - 2 && u > U[k + 1]) k++;
  const t = (u - U[k]) / (U[k + 1] - U[k]);
  const p0 = ys[Math.max(0, k - 1)];
  const p1 = ys[k];
  const p2 = ys[k + 1];
  const p3 = ys[Math.min(U.length - 1, k + 2)];
  const v =
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  return Math.max(0, Math.min(Math.max(p1, p2) * 1.02, v));
};
export const bodyX = (u: number) => X0 + (X1 - X0) * u;
export const bodyU = (x: number) => (x - X0) / (X1 - X0);
const yc = (u: number) => -0.055 * (1 - smooth(0, 0.3, u));
export const bodyTop = (u: number) => yc(u) + cr(TOP, u);
export const bodyBot = (u: number) => yc(u) - cr(BOT, u);
export const bodyWid = (u: number) => cr(WID, u);
/** half-width of the body at (u, y) */
export const sideZ = (u: number, y: number) => {
  const c = yc(u);
  const h = y > c ? cr(TOP, u) : cr(BOT, u);
  const k = h > 0 ? (y - c) / h : 0;
  return cr(WID, u) * Math.sqrt(Math.max(0, 1 - k * k));
};

const bodyGeometry = () =>
  memo("bodyGeo", () => {
    const NU = 80;
    const NV = 40;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= NU + 1; i++) {
      const u = i > NU ? 1 : U_LIP + (1 - U_LIP) * (i / NU);
      const shrink = i > NU ? 0 : 1; // closing cap at the tail base
      const t = cr(TOP, u) * shrink;
      const b = cr(BOT, u) * shrink;
      const w = cr(WID, u) * shrink;
      for (let j = 0; j <= NV; j++) {
        const th = (j / NV) * Math.PI * 2;
        const c = Math.cos(th);
        pos.push(bodyX(u) - (i > NU ? 0.03 : 0), yc(u) + c * (c > 0 ? t : b), Math.sin(th) * w);
        // canvas textures are flipped: v = 1 is the top row of the canvas (the back)
        uv.push(u, 1 - (th <= Math.PI ? th / Math.PI : (2 * Math.PI - th) / Math.PI));
      }
    }
    for (let i = 0; i <= NU; i++)
      for (let j = 0; j < NV; j++) {
        const a = i * (NV + 1) + j;
        const b = a + NV + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

/** fleshy lips: a soft ring around the mouth opening */
const lipGeometry = () =>
  memo("lipGeo", () => {
    const NV = 48;
    const NP = 10;
    const R = 0.011;
    const pos: number[] = [];
    const idx: number[] = [];
    const t = cr(TOP, U_LIP);
    const b = cr(BOT, U_LIP);
    const w = cr(WID, U_LIP);
    for (let j = 0; j <= NV; j++) {
      const th = (j / NV) * Math.PI * 2;
      const c = Math.cos(th);
      const cy = c * (c > 0 ? t : b);
      const cz = Math.sin(th) * w;
      const rad = V(0, cy, cz).normalize();
      for (let k = 0; k <= NP; k++) {
        const ph = (k / NP) * Math.PI * 2;
        pos.push(bodyX(U_LIP) + Math.sin(ph) * R * 1.2, yc(U_LIP) + cy * 0.985 + rad.y * Math.cos(ph) * R, cz * 0.985 + rad.z * Math.cos(ph) * R);
      }
    }
    for (let j = 0; j < NV; j++)
      for (let k = 0; k < NP; k++) {
        const a = j * (NP + 1) + k;
        const c = a + NP + 1;
        idx.push(a, c, a + 1, c, c + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

// --- beak: two plates of fused teeth set inside the lips, with a "smile" between them
const BEAK_C = V(0.9, -0.055, 0);
const BEAK_PIVOT = 0.8;
export const BEAK_TIP = V(1.032, -0.055, 0);
const beakGeometry = (upper: boolean) =>
  memo("beak" + upper, () => {
    const NA = 32;
    const NB = 12;
    const A = 0.95;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= NA; i++) {
      const a = -A + (2 * A * i) / NA;
      const k = (a / A) ** 2;
      // mouth line rises towards the corners -> smile
      const edge = 0.03 + 0.26 * k;
      const far = upper ? 0.95 - 0.2 * k : -0.9 + 0.3 * k;
      const e0 = upper ? edge : edge - 0.035;
      for (let j = 0; j <= NB; j++) {
        const b = e0 + ((far - e0) * j) / NB;
        pos.push(Math.cos(b) * Math.cos(a) * 0.132, Math.sin(b) * (upper ? 0.094 : 0.086), Math.cos(b) * Math.sin(a) * 0.104);
        uv.push(i / NA, j / NB);
      }
    }
    for (let i = 0; i < NA; i++)
      for (let j = 0; j < NB; j++) {
        const p = i * (NB + 1) + j;
        const q = p + NB + 1;
        if (upper) idx.push(p, p + 1, q, q, p + 1, q + 1);
        else idx.push(p, q, p + 1, q, q + 1, p + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

// --- fins --------------------------------------------------------------------
const finGeometries = () =>
  memo("fins", () => {
    const N = 22;
    const dBase: THREE.Vector3[] = [];
    const dTip: THREE.Vector3[] = [];
    const aBase: THREE.Vector3[] = [];
    const aTip: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const u = 0.27 + 0.62 * k;
      const env = Math.sin(Math.PI * Math.min(1, k * 1.08) ** 0.55) ** 0.6 * (1 - 0.35 * k) + 0.02;
      dBase.push(V(bodyX(u), bodyTop(u) - 0.03, 0));
      dTip.push(V(bodyX(u) - 0.06 - 0.05 * k, bodyTop(u) + 0.13 * env + 0.006 * Math.sin(i * 2.4), 0));
      const u2 = 0.6 + 0.29 * k;
      const env2 = Math.sin(Math.PI * k ** 0.6) ** 0.6 * (1 - 0.3 * k) + 0.02;
      aBase.push(V(bodyX(u2), bodyBot(u2) + 0.03, 0));
      aTip.push(V(bodyX(u2) - 0.07, bodyBot(u2) - 0.12 * env2, 0));
    }
    const tBase: THREE.Vector3[] = [];
    const tTip: THREE.Vector3[] = [];
    const pBase: THREE.Vector3[] = [];
    const pTip: THREE.Vector3[] = [];
    const vBase: THREE.Vector3[] = [];
    const vTip: THREE.Vector3[] = [];
    const M = 14;
    for (let i = 0; i <= M; i++) {
      const k = (i / M) * 2 - 1;
      tBase.push(V(0, k * 0.105, 0));
      tTip.push(V(-(0.38 + 0.12 * k * k), k * 0.36, 0));
      const a = 0.75 - (i / M) * 1.65;
      const L = 0.38 * (0.75 + 0.25 * Math.sin((Math.PI * i) / M));
      pBase.push(V(0, 0.06 - (i / M) * 0.12, 0));
      pTip.push(V(-Math.cos(a) * L, Math.sin(a) * L, 0));
      const a2 = -0.5 - (i / M) * 0.9;
      vBase.push(V(-(i / M) * 0.1, 0, 0));
      vTip.push(V(-Math.cos(a2) * 0.2 - (i / M) * 0.05, Math.sin(a2) * 0.2, 0));
    }
    return {
      dorsal: ribbon(dBase, dTip),
      anal: ribbon(aBase, aTip),
      tail: ribbon(tBase, tTip, 6),
      pectoral: ribbon(pBase, pTip, 5),
      pelvic: ribbon(vBase, vTip),
    };
  });

// --- internals ------------------------------------------------------------------
export const MILL = V(0.44, -0.05, 0); // pharyngeal jaws, in the throat
export const VENT = V(-0.6, -0.17, 0); // where the sand comes out: at the back, near the tail
export const GUT = new THREE.CatmullRomCurve3([
  V(0.9, -0.06, 0),
  V(0.62, -0.055, 0),
  MILL.clone(),
  V(0.2, -0.09, 0),
  V(-0.05, -0.15, 0),
  V(-0.3, -0.18, 0),
  V(-0.48, -0.17, 0),
  VENT.clone(),
]);

const sphere = () => memo("sph", () => new THREE.SphereGeometry(1, 24, 16));
const sphereLo = () => memo("sphLo", () => new THREE.SphereGeometry(1, 10, 8));

export type FishProps = {
  /** animation clock in seconds */
  t: number;
  swim?: number;
  /** jaw opening 0..1 */
  open?: number;
  /** 0..1: translucent "x-ray" */
  xray?: number;
  /** how far back the x-ray goes: 0 = head only, 1 = whole body */
  xrayReach?: number;
  beakGlow?: number;
  millGlow?: number;
  millPhase?: number;
  /** 0..1: new rows of teeth grow in from the base and push the others forward */
  beakGrow?: number;
  look?: [number, number];
  /** 0 = relaxed, 1 = worried (small pupils) */
  worry?: number;
  /** hide the eyes (x-ray close-up on the throat) */
  noEyes?: boolean;
  /** 0..1 moonlit rim glow around the silhouette (night scenes) */
  rim?: number;
  palette?: FishPalette;
  paletteKey?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<"group">, "children">;

export const Fish: React.FC<FishProps> = ({
  t,
  swim = 1,
  open = 0.22,
  xray = 0,
  xrayReach = 0,
  beakGlow = 0,
  millGlow = 0,
  millPhase = 0,
  beakGrow = 0,
  look = [0, 0],
  worry = 0,
  noEyes = false,
  rim = 0,
  palette = INITIAL_PHASE,
  paletteKey = "initial",
  children,
  ...group
}) => {
  const skin = fishSkin(palette, paletteKey);
  const fins = finGeometries();
  const mats = useMemo(() => {
    const body = causticMaterial({ map: skin.map, bumpMap: skin.bump, bumpScale: 2.2, roughness: 0.48, metalness: 0.05 }, 0.5);
    const xbody = new THREE.MeshStandardMaterial({
      map: skin.map,
      color: "#5f8ea6",
      roughness: 0.5,
      transparent: true,
      depthWrite: false,
    });
    const u = { uX: { value: 0 }, uEdge: { value: 0.4 } };
    xbody.onBeforeCompile = (sh) => {
      sh.uniforms.uX = u.uX;
      sh.uniforms.uEdge = u.uEdge;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uX; uniform float uEdge;")
        .replace(
          "#include <map_fragment>",
          "#include <map_fragment>\ndiffuseColor.a *= 1.0 - uX * 0.72 * (1.0 - smoothstep(uEdge, uEdge + 0.2, vMapUv.x));",
        );
    };
    const fin = new THREE.MeshStandardMaterial({
      map: finTexture(),
      side: THREE.DoubleSide,
      roughness: 0.6,
      transparent: true,
      opacity: 0.94,
    });
    const lip = causticMaterial({ color: new THREE.Color(palette.head).lerp(new THREE.Color(palette.chin), 0.45), roughness: 0.5 }, 0.4);
    const beak = new THREE.MeshStandardMaterial({
      map: beakTexture(),
      emissiveMap: beakTexture(),
      emissive: new THREE.Color("#e9ecc8"),
      emissiveIntensity: 0.28,
      roughness: 0.28,
      side: THREE.DoubleSide,
    });
    // x-ray version: bright cream, the rows of fused teeth can slide towards the cutting edge
    const rows = beakTexture(true).clone();
    rows.needsUpdate = true;
    const xbeak = new THREE.MeshBasicMaterial({ map: rows, side: THREE.DoubleSide, fog: false, transparent: true });
    const outline = new THREE.MeshBasicMaterial({ color: "#07161c", side: THREE.DoubleSide, fog: false, transparent: true, depthWrite: false });
    const fresh = new THREE.ShaderMaterial({
      uniforms: { uBand: { value: 0 }, uPulse: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uBand; uniform float uPulse; varying vec2 vUv;
        void main(){ if (vUv.y < 1.0 - uBand) discard; gl_FragColor = vec4(1.0, 0.82, 0.25, 0.45 + 0.3 * uPulse); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const rimM = xrayMaterial("#8fe9ff");
    const moon = xrayMaterial("#9cc4ff");
    const bone = new THREE.MeshStandardMaterial({
      color: "#fff4d8",
      emissive: new THREE.Color("#ffd23f"),
      emissiveIntensity: 0,
      roughness: 0.45,
    });
    const spine = new THREE.MeshBasicMaterial({ color: "#d9f6ff", transparent: true, opacity: 0.5, depthWrite: false });
    const gut = new THREE.MeshBasicMaterial({
      color: "#ff9d8a",
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { body, xbody, u, fin, lip, beak, xbeak, rows, outline, fresh, rim: rimM, moon, bone, spine, gut };
  }, [skin, palette]);
  const gutGeo = useMemo(() => new THREE.TubeGeometry(GUT, 48, 0.04, 8), []);

  const x = xray > 0.001;
  mats.u.uX.value = xray;
  mats.u.uEdge.value = 0.36 + xrayReach * 1.2;
  mats.rim.uniforms.uOpacity.value = xray * 0.4;
  mats.moon.uniforms.uOpacity.value = rim * 0.55;
  mats.bone.emissiveIntensity = 0.25 + 1.1 * millGlow;
  mats.fin.opacity = 0.94 - 0.72 * xray;
  // two new rows come in from the base
  const NEW = 2 / 9;
  mats.rows.offset.y = beakGrow * NEW;
  mats.fresh.uniforms.uBand.value = beakGrow * NEW * 1.05;
  mats.fresh.uniforms.uPulse.value = 0.5 + 0.5 * Math.sin(t * 14);
  const bright = x && beakGlow > 0.2;
  const beakMat = bright ? mats.xbeak : mats.beak;

  const beat = t * 7.5;
  const sway = swim * 0.16 * Math.sin(beat * 0.5);
  const flap = swim * Math.sin(beat);
  const jaw = open * 0.5;

  const eye = (side: number) => {
    const ex = 0.62;
    const ey = 0.115;
    const ez = sideZ(bodyU(ex), ey) * side;
    const R = 0.062;
    const pupil = R * (0.56 - 0.18 * worry);
    return (
      <group position={[ex, ey, ez * 0.9]} rotation={[0, side > 0 ? -0.2 : 0.2, 0]}>
        {/* dark socket ring */}
        <mesh geometry={sphere()} scale={[R * 1.12, R * 1.12, R * 0.3]} position={[0, 0, side * R * 0.1]}>
          <meshStandardMaterial color="#3a2a26" roughness={0.6} />
        </mesh>
        <mesh geometry={sphere()} scale={[R, R, R * 0.45]} position={[0, 0, side * R * 0.2]}>
          <meshStandardMaterial color="#e8a03c" roughness={0.18} emissive="#6a3205" emissiveIntensity={0.35} />
        </mesh>
        <mesh geometry={sphere()} scale={[pupil, pupil, R * 0.2]} position={[look[0] * R * 0.36, look[1] * R * 0.36, side * R * 0.5]}>
          <meshStandardMaterial color="#070707" roughness={0.1} />
        </mesh>
        <mesh geometry={sphereLo()} scale={R * 0.2} position={[look[0] * R * 0.3 + R * 0.24, look[1] * R * 0.3 + R * 0.28, side * R * 0.68]}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh geometry={sphereLo()} scale={R * 0.09} position={[look[0] * R * 0.3 - R * 0.2, look[1] * R * 0.3 - R * 0.2, side * R * 0.68]}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    );
  };

  const pectoral = (side: number) => {
    const u = bodyU(0.32);
    return (
      <group position={[0.32, -0.1, side * (sideZ(u, -0.1) + 0.005)]} rotation={[side * (0.25 + 0.2 * flap), side * (-0.55 - 0.45 * flap), 0.15 * flap]}>
        <mesh geometry={fins.pectoral} material={mats.fin} />
      </group>
    );
  };

  const molars = (y: number, zs: number[]) =>
    zs.flatMap((z) =>
      [-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <mesh key={`${z}_${i}`} geometry={sphereLo()} material={mats.bone} position={[i * 0.027, y, z]} scale={[0.016, 0.014, 0.016]} />
      )),
    );
  const mx = 0.03 * Math.sin(millPhase);
  const my = 0.006 * Math.cos(millPhase * 2);
  const bx = BEAK_C.x - BEAK_PIVOT;
  const plate = (upper: boolean, material: THREE.Material, s = 1, dx = 0, order = 0) => (
    <group rotation={[0, 0, upper ? jaw * 0.3 : -jaw]}>
      <mesh geometry={beakGeometry(upper)} material={material} position={[bx + dx, 0, 0]} scale={[s * (1 + 0.1 * beakGrow), s, s]} renderOrder={order} />
    </group>
  );

  return (
    <group {...group}>
      <group rotation={[0, swim * 0.05 * Math.sin(beat * 0.5 + 1.2), 0]}>
        <mesh geometry={bodyGeometry()} material={x ? mats.xbody : mats.body} renderOrder={x ? 3 : 0} />
        {x && <mesh geometry={bodyGeometry()} material={mats.rim} scale={1.012} renderOrder={4} />}
        {!x && rim > 0.01 && <mesh geometry={bodyGeometry()} material={mats.moon} scale={1.02} renderOrder={4} />}
        {!x && <mesh geometry={lipGeometry()} material={mats.lip} />}
        {!noEyes && eye(1)}
        {!noEyes && eye(-1)}
        {/* mouth: dark inside + the two beak plates, inside the lips */}
        {!x && (
          <mesh geometry={sphere()} position={[0.885, -0.055, 0]} scale={[0.1, 0.09, 0.098]}>
            <meshBasicMaterial color="#1c0b0e" />
          </mesh>
        )}
        <group position={[BEAK_PIVOT, BEAK_C.y, 0]}>
          {bright && plate(true, mats.outline, 1.1, -0.004, 5)}
          {bright && plate(false, mats.outline, 1.1, -0.004, 5)}
          {plate(true, beakMat, 1, 0, bright ? 6 : 0)}
          {plate(false, beakMat, 1, 0, bright ? 6 : 0)}
          {bright && beakGrow > 0.01 && plate(true, mats.fresh, 1.012, 0, 7)}
          {bright && beakGrow > 0.01 && plate(false, mats.fresh, 1.012, 0, 7)}
        </group>
        {bright && (
          <sprite position={[0.96, -0.055, 0]} scale={0.55 * beakGlow} renderOrder={2}>
            <spriteMaterial map={softSprite()} color="#fff1c0" transparent opacity={0.28 * beakGlow} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} fog={false} />
          </sprite>
        )}
        {x && millGlow > 0.05 && (
          <sprite position={MILL} scale={0.6 * millGlow} renderOrder={2}>
            <spriteMaterial map={softSprite()} color="#ffd23f" transparent opacity={0.3 * millGlow} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} fog={false} />
          </sprite>
        )}
        {/* fins */}
        <mesh geometry={fins.dorsal} material={mats.fin} />
        <mesh geometry={fins.anal} material={mats.fin} />
        <group position={[X1 + 0.03, 0, 0]} rotation={[0, sway * 1.6, 0]}>
          <mesh geometry={fins.tail} material={mats.fin} />
        </group>
        {pectoral(1)}
        {pectoral(-1)}
        {[1, -1].map((sd) => (
          <group key={sd} position={[0.2, bodyBot(bodyU(0.2)) + 0.03, sd * 0.07]} rotation={[sd * 0.5, 0, 0]}>
            <mesh geometry={fins.pelvic} material={mats.fin} />
          </group>
        ))}
        {/* inside (only seen through the x-ray) */}
        {x && (
          <group>
            <mesh geometry={gutGeo} material={mats.gut} renderOrder={1} />
            {xrayReach > 0.3 &&
              Array.from({ length: 22 }, (_, i) => {
                const px = 0.3 - i * 0.052;
                const u = bodyU(px);
                const mid = (bodyTop(u) + bodyBot(u)) / 2 + 0.06;
                const hgt = (bodyTop(u) - bodyBot(u)) * 0.3;
                return (
                  <group key={i} position={[px, mid, 0]}>
                    <mesh geometry={sphereLo()} material={mats.spine} scale={[0.02, 0.02, 0.02]} renderOrder={1} />
                    <mesh material={mats.spine} position={[-0.02, hgt / 2, 0]} rotation={[0, 0, 0.25]} renderOrder={1}>
                      <boxGeometry args={[0.007, hgt, 0.007]} />
                    </mesh>
                    <mesh material={mats.spine} position={[-0.02, -hgt / 2, 0]} rotation={[0, 0, -0.25]} renderOrder={1}>
                      <boxGeometry args={[0.007, hgt, 0.007]} />
                    </mesh>
                  </group>
                );
              })}
            {/* pharyngeal mill: upper pair of plates + lower plate, molar-like teeth facing each other */}
            <group position={MILL} renderOrder={2}>
              <group position={[mx, 0.04 - my, 0]}>
                {[0.04, -0.04].map((z) => (
                  <mesh key={z} geometry={sphere()} material={mats.bone} position={[0, 0.02, z]} scale={[0.105, 0.03, 0.04]} />
                ))}
                {molars(-0.008, [0.055, 0.027, -0.027, -0.055])}
              </group>
              <group position={[-mx, -0.04 + my, 0]}>
                <mesh geometry={sphere()} material={mats.bone} position={[0, -0.02, 0]} scale={[0.112, 0.03, 0.078]} />
                {molars(0.008, [0.055, 0.027, 0, -0.027, -0.055])}
              </group>
            </group>
          </group>
        )}
        {children}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Cleaner wrasse: small, blue, with a black stripe from the snout to the tail
// ---------------------------------------------------------------------------
const cleanerTexture = () =>
  memo("cleaner", () => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "#2f8bff");
    gr.addColorStop(0.42, "#56c4ff");
    gr.addColorStop(1, "#eaf6ff");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
    // black stripe, getting wider towards the tail (v=0.5 is the flank)
    g.fillStyle = "#0b0b12";
    g.beginPath();
    g.moveTo(0, 60);
    g.lineTo(256, 30);
    g.lineTo(256, 98);
    g.lineTo(0, 70);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

const cleanerGeo = () =>
  memo("cleanerGeo", () => {
    const g = new THREE.SphereGeometry(1, 28, 18);
    // u along the body (x), v = back -> belly
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      uv.setXY(i, 0.5 - p.getX(i) / 2, 0.5 - p.getY(i) / 2);
    }
    return g;
  });

export const Cleaner: React.FC<
  { t: number; swim?: number; asleep?: boolean } & Omit<React.ComponentProps<"group">, "children">
> = ({ t, swim = 1, asleep = false, ...group }) => {
  const mat = useMemo(
    () => causticMaterial({ map: cleanerTexture(), roughness: 0.35 }, 0.4),
    [],
  );
  const fin = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: finTexture("#2f8bff", "#9fdcff", "#0b0b12"),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      }),
    [],
  );
  const fins = finGeometries();
  const w = swim * Math.sin(t * 16);
  return (
    <group {...group}>
      <group rotation={[0, 0.12 * w, 0]}>
        <mesh geometry={cleanerGeo()} material={mat} scale={[0.5, 0.105, 0.07]} />
        <group position={[-0.47, 0, 0]} rotation={[0, 0.5 * w, 0]} scale={[0.45, 0.5, 1]}>
          <mesh geometry={fins.tail} material={fin} />
        </group>
        <mesh geometry={fins.pectoral} material={fin} position={[0.18, -0.03, 0.06]} rotation={[0.3, -0.7 - 0.4 * w, 0]} scale={0.3} />
        <mesh geometry={fins.pectoral} material={fin} position={[0.18, -0.03, -0.06]} rotation={[-0.3, 0.7 + 0.4 * w, 0]} scale={0.3} />
        {[1, -1].map((s) => (
          <group key={s} position={[0.33, 0.025, s * 0.052]}>
            <mesh geometry={sphere()} scale={[0.03, 0.03, 0.016]}>
              <meshStandardMaterial color={asleep ? "#1d5fbd" : "#ffffff"} roughness={0.2} />
            </mesh>
            {!asleep && (
              <mesh geometry={sphereLo()} scale={[0.017, 0.017, 0.01]} position={[0.004, 0, s * 0.012]}>
                <meshBasicMaterial color="#050505" />
              </mesh>
            )}
            {asleep && (
              <mesh position={[0, -0.004, s * 0.017]} scale={[0.03, 0.006, 0.004]} geometry={sphereLo()}>
                <meshBasicMaterial color="#061226" />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
};
