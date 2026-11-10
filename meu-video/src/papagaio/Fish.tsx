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

// --- body profile (u = 0 snout .. 1 tail base) ------------------------------
const U = [0, 0.02, 0.06, 0.12, 0.2, 0.32, 0.45, 0.6, 0.75, 0.88, 0.95, 1];
const TOP = [0, 0.155, 0.26, 0.37, 0.455, 0.51, 0.52, 0.47, 0.36, 0.22, 0.165, 0.15];
const BOT = [0, 0.135, 0.2, 0.28, 0.37, 0.44, 0.46, 0.42, 0.31, 0.19, 0.155, 0.15];
const WID = [0, 0.13, 0.185, 0.23, 0.275, 0.3, 0.29, 0.24, 0.17, 0.095, 0.065, 0.05];
const X0 = 1.0;
const X1 = -0.85;
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
const yc = (u: number) => -0.06 * (1 - smooth(0, 0.3, u));
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
    const NU = 72;
    const NV = 36;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= NU + 1; i++) {
      const u = Math.min(1, i / NU);
      const shrink = i > NU ? 0 : 1; // closing cap at the tail base
      const t = cr(TOP, u) * shrink;
      const b = cr(BOT, u) * shrink;
      const w = cr(WID, u) * shrink;
      for (let j = 0; j <= NV; j++) {
        const th = (j / NV) * Math.PI * 2;
        const c = Math.cos(th);
        pos.push(bodyX(u) - (i > NU ? 0.03 : 0), yc(u) + c * (c > 0 ? t : b), Math.sin(th) * w);
        uv.push(u, th <= Math.PI ? th / Math.PI : (2 * Math.PI - th) / Math.PI);
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

// --- beak: two plates of fused teeth, with a "smile" between them -----------
const BEAK_C = V(0.875, -0.06, 0);
const beakGeometry = (upper: boolean) =>
  memo("beak" + upper, () => {
    const NA = 28;
    const NB = 10;
    const A = 0.92;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= NA; i++) {
      const a = -A + (2 * A * i) / NA;
      const k = (a / A) ** 2;
      // mouth line rises towards the corners -> smile
      const edge = 0.02 + 0.2 * k;
      const far = upper ? 0.72 - 0.2 * k : -0.62 + 0.28 * k;
      for (let j = 0; j <= NB; j++) {
        const b = upper ? edge + ((far - edge) * j) / NB : edge - 0.06 + ((far - (edge - 0.06)) * j) / NB;
        pos.push(Math.cos(b) * Math.cos(a) * 0.155, Math.sin(b) * 0.135, Math.cos(b) * Math.sin(a) * 0.16);
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
      const u = 0.3 + 0.58 * k;
      const env = Math.sin(Math.PI * Math.min(1, k * 1.08) ** 0.55) ** 0.6 * (1 - 0.35 * k) + 0.02;
      dBase.push(V(bodyX(u), bodyTop(u) - 0.03, 0));
      dTip.push(V(bodyX(u) - 0.06 - 0.05 * k, bodyTop(u) + 0.17 * env + 0.008 * Math.sin(i * 2.4), 0));
      const u2 = 0.6 + 0.28 * k;
      const env2 = Math.sin(Math.PI * k ** 0.6) ** 0.6 * (1 - 0.3 * k) + 0.02;
      aBase.push(V(bodyX(u2), bodyBot(u2) + 0.03, 0));
      aTip.push(V(bodyX(u2) - 0.07, bodyBot(u2) - 0.15 * env2, 0));
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
      tBase.push(V(0, k * 0.14, 0));
      tTip.push(V(-(0.4 + 0.13 * k * k), k * 0.44, 0));
      const a = 0.75 - (i / M) * 1.65;
      const L = 0.46 * (0.75 + 0.25 * Math.sin((Math.PI * i) / M));
      pBase.push(V(0, 0.07 - (i / M) * 0.14, 0));
      pTip.push(V(-Math.cos(a) * L, Math.sin(a) * L, 0));
      const a2 = -0.5 - (i / M) * 0.9;
      vBase.push(V(-(i / M) * 0.1, 0, 0));
      vTip.push(V(-Math.cos(a2) * 0.26 - (i / M) * 0.05, Math.sin(a2) * 0.26, 0));
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
export const VENT = V(-0.4, -0.4, 0); // where the sand comes out
export const GUT = new THREE.CatmullRomCurve3([
  V(0.9, -0.07, 0),
  V(0.62, -0.06, 0),
  MILL.clone(),
  V(0.2, -0.1, 0),
  V(-0.05, -0.2, 0),
  V(-0.25, -0.3, 0),
  VENT.clone(),
]);

const sphere = () => memo("sph", () => new THREE.SphereGeometry(1, 20, 14));
const sphereLo = () => memo("sphLo", () => new THREE.SphereGeometry(1, 8, 6));

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
  beakGrow?: number;
  look?: [number, number];
  /** 0 = relaxed, 1 = worried (small pupils) */
  worry?: number;
  /** hide the eyes (x-ray close-up on the throat) */
  noEyes?: boolean;
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
    const beak = new THREE.MeshStandardMaterial({
      map: beakTexture(),
      emissiveMap: beakTexture(),
      emissive: new THREE.Color("#ffe9a8"),
      emissiveIntensity: 0,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const ghost = new THREE.MeshBasicMaterial({
      color: "#FFD23F",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rim = xrayMaterial("#8fe9ff");
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
    return { body, xbody, u, fin, beak, ghost, rim, bone, spine, gut };
  }, [skin]);
  const gutGeo = useMemo(() => new THREE.TubeGeometry(GUT, 40, 0.045, 8), []);

  const x = xray > 0.001;
  mats.u.uX.value = xray;
  mats.u.uEdge.value = 0.36 + xrayReach * 1.2;
  mats.rim.uniforms.uOpacity.value = xray * 0.45;
  mats.beak.emissiveIntensity = 0.22 + 0.9 * beakGlow;
  mats.bone.emissiveIntensity = 0.25 + 1.1 * millGlow;
  mats.fin.opacity = 0.94 - 0.72 * xray;
  mats.ghost.opacity = 0.55 * beakGrow;

  const beat = t * 7.5;
  const sway = swim * 0.16 * Math.sin(beat * 0.5);
  const flap = swim * Math.sin(beat);
  const jaw = open * 0.5;

  const eye = (side: number) => {
    const ex = 0.6;
    const ey = 0.17;
    const ez = sideZ(bodyU(ex), ey) * side;
    const R = 0.098;
    const pupil = R * (0.6 - 0.2 * worry);
    return (
      <group position={[ex, ey, ez * 0.9]} rotation={[0, side > 0 ? -0.22 : 0.22, 0]}>
        {/* dark socket ring */}
        <mesh geometry={sphere()} scale={[R * 1.14, R * 1.14, R * 0.55]} position={[0, 0, side * R * 0.2]}>
          <meshStandardMaterial color="#3a2a26" roughness={0.6} />
        </mesh>
        <mesh geometry={sphere()} scale={[R, R, R * 0.8]} position={[0, 0, side * R * 0.38]}>
          <meshStandardMaterial color="#f4a53c" roughness={0.18} emissive="#7a3a05" emissiveIntensity={0.35} />
        </mesh>
        <mesh
          geometry={sphere()}
          scale={[pupil, pupil, R * 0.3]}
          position={[look[0] * R * 0.38, look[1] * R * 0.38, side * R * 0.96]}
        >
          <meshStandardMaterial color="#070707" roughness={0.1} />
        </mesh>
        <mesh
          geometry={sphereLo()}
          scale={R * 0.2}
          position={[look[0] * R * 0.3 + R * 0.26, look[1] * R * 0.3 + R * 0.3, side * R * 1.2]}
        >
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh
          geometry={sphereLo()}
          scale={R * 0.09}
          position={[look[0] * R * 0.3 - R * 0.22, look[1] * R * 0.3 - R * 0.2, side * R * 1.2]}
        >
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    );
  };

  const pectoral = (side: number) => {
    const u = bodyU(0.3);
    return (
      <group
        position={[0.3, -0.12, side * (sideZ(u, -0.12) + 0.005)]}
        rotation={[side * (0.25 + 0.2 * flap), side * (-0.55 - 0.45 * flap), 0.15 * flap]}
      >
        <mesh geometry={fins.pectoral} material={mats.fin} />
      </group>
    );
  };

  const molars = (y: number, zs: number[]) =>
    zs.flatMap((z) =>
      [-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <mesh key={`${z}_${i}`} geometry={sphereLo()} material={mats.bone} position={[i * 0.034, y, z]} scale={[0.02, 0.016, 0.02]} />
      )),
    );
  const mx = 0.04 * Math.sin(millPhase);
  const my = 0.008 * Math.cos(millPhase * 2);

  return (
    <group {...group}>
      <group rotation={[0, swim * 0.05 * Math.sin(beat * 0.5 + 1.2), 0]}>
        <mesh geometry={bodyGeometry()} material={x ? mats.xbody : mats.body} renderOrder={x ? 3 : 0} />
        {x && <mesh geometry={bodyGeometry()} material={mats.rim} scale={1.012} renderOrder={4} />}
        {!noEyes && eye(1)}
        {!noEyes && eye(-1)}
        {beakGlow > 0.3 && (
          <sprite position={[0.95, -0.06, 0]} scale={1.1 * beakGlow} renderOrder={2}>
            <spriteMaterial map={softSprite()} color="#ffe9a0" transparent opacity={0.4 * beakGlow} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} fog={false} />
          </sprite>
        )}
        {x && millGlow > 0.05 && (
          <sprite position={MILL} scale={0.75 * millGlow} renderOrder={2}>
            <spriteMaterial map={softSprite()} color="#ffd23f" transparent opacity={0.35 * millGlow} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} fog={false} />
          </sprite>
        )}
        {/* mouth: dark inside + the two beak plates */}
        <mesh geometry={sphere()} position={[0.86, -0.06, 0]} scale={x ? [0.07, 0.05, 0.07] : [0.125, 0.085, 0.125]}>
          <meshBasicMaterial color="#1c0b0e" />
        </mesh>
        <group position={[0.72, -0.06, 0]}>
          <group rotation={[0, 0, jaw * 0.3]} scale={[1 + 0.45 * beakGrow, 1, 1]}>
            <mesh geometry={beakGeometry(true)} material={mats.beak} position={[BEAK_C.x - 0.72, 0, 0]} />
          </group>
          <group rotation={[0, 0, -jaw]} scale={[1 + 0.45 * beakGrow, 1, 1]}>
            <mesh geometry={beakGeometry(false)} material={mats.beak} position={[BEAK_C.x - 0.72, 0, 0]} />
          </group>
          {beakGrow > 0.01 && (
            <group scale={[1 + 0.75 * beakGrow, 1.04, 1.04]}>
              <mesh geometry={beakGeometry(true)} material={mats.ghost} position={[BEAK_C.x - 0.72, 0, 0]} rotation={[0, 0, jaw * 0.3]} />
              <mesh geometry={beakGeometry(false)} material={mats.ghost} position={[BEAK_C.x - 0.72, 0, 0]} rotation={[0, 0, -jaw]} />
            </group>
          )}
        </group>
        {/* fins */}
        <mesh geometry={fins.dorsal} material={mats.fin} />
        <mesh geometry={fins.anal} material={mats.fin} />
        <group position={[X1 + 0.03, 0, 0]} rotation={[0, sway * 1.6, 0]}>
          <mesh geometry={fins.tail} material={mats.fin} />
        </group>
        {pectoral(1)}
        {pectoral(-1)}
        {[1, -1].map((s) => (
          <group key={s} position={[0.2, bodyBot(bodyU(0.2)) + 0.04, s * 0.09]} rotation={[s * 0.5, 0, 0]}>
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
                const mid = (bodyTop(u) + bodyBot(u)) / 2 + 0.07;
                const hgt = (bodyTop(u) - bodyBot(u)) * 0.3;
                return (
                  <group key={i} position={[px, mid, 0]}>
                    <mesh geometry={sphereLo()} material={mats.spine} scale={[0.02, 0.022, 0.022]} renderOrder={1} />
                    <mesh material={mats.spine} position={[-0.02, hgt / 2, 0]} rotation={[0, 0, 0.25]} renderOrder={1}>
                      <boxGeometry args={[0.008, hgt, 0.008]} />
                    </mesh>
                    <mesh material={mats.spine} position={[-0.02, -hgt / 2, 0]} rotation={[0, 0, -0.25]} renderOrder={1}>
                      <boxGeometry args={[0.008, hgt, 0.008]} />
                    </mesh>
                  </group>
                );
              })}
            <group position={MILL} renderOrder={2}>
              <group position={[mx, 0.052 - my, 0]}>
                {[0.052, -0.052].map((z) => (
                  <mesh key={z} geometry={sphere()} material={mats.bone} position={[0, 0.022, z]} scale={[0.135, 0.04, 0.05]} />
                ))}
                {molars(-0.012, [0.07, 0.035, -0.035, -0.07])}
              </group>
              <group position={[-mx, -0.052 + my, 0]}>
                <mesh geometry={sphere()} material={mats.bone} position={[0, -0.024, 0]} scale={[0.145, 0.04, 0.1]} />
                {molars(0.012, [0.07, 0.035, 0, -0.035, -0.07])}
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
