// "Peixe-papagaio – parte 1/3": all the 3D shots. Each scene is a small component that
// places the camera (never static) and the set for its local frame.
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { bodyU, Cleaner, Fish, GUT, MILL, sideZ, VENT } from "./Fish";
import { alphaPoints, clamp, memo, rng, sat, softSprite, V } from "./gfx";
import { GlobeSet, useAssets } from "./Globe";
import { AerialSet } from "./Island";
import { Bubbles, Coral, CoralField, Isopod, Mound, ReefEnv, rockGeometry, SandCloud, Swarm, SwarmPose } from "./Reef";
import {
  C1_ISLAND,
  C1_RISE,
  C1_SAND,
  C2_BITE,
  C2_BITE_CUT,
  C2_GROW,
  C3_B,
  C3_CLANK,
  C3_STONE,
  C4_GRIND,
  C4_MILL,
  C4_WIDE,
  C5_85,
  C5_AERIAL,
  C5_COUNT,
  C5_FACTORY,
  C5_GLOBE,
  C5_PIN,
  C5_SCHOOL,
  C6_AROUND,
  C6_BLOOD,
  C6_DROP,
  C6_SWARM,
  C7_B,
  C7_NIGHT,
  C8_A,
  C8_B,
  C9_WARN,
  DURATION,
  FPS,
  FREEZE,
  S,
  sceneOf,
} from "./timeline";

const io = Easing.inOut(Easing.cubic);
const out = Easing.out(Easing.cubic);
const ip = (f: number, a: number, b: number, x: number, y: number, e: (n: number) => number = io) =>
  interpolate(f, [a, b], [x, y], { ...clamp, easing: e });
const pulse = (f: number, at: number, len: number) => {
  const k = (f - at) / len;
  return k < 0 || k > 1 ? 0 : Math.sin(Math.PI * k);
};

type Cam = { pos: THREE.Vector3; target: THREE.Vector3; fov?: number; roll?: number };
const Rig: React.FC<Cam> = ({ pos, target, fov = 40, roll = 0 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.copy(pos);
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(target);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

// handheld drift so no shot is ever static
const drift = (f: number, amp = 0.04) => V(Math.sin(f * 0.07) * amp, Math.sin(f * 0.05 + 1) * amp, Math.sin(f * 0.043 + 2) * amp);
const shake = (f: number, at: number, amp: number, len = 10) => {
  const k = f - at;
  if (k < 0 || k > len) return V(0, 0, 0);
  const a = amp * (1 - k / len);
  return V(Math.sin(k * 5.1) * a, Math.cos(k * 6.7) * a, 0);
};

const rockMat = () =>
  memo("rockMatScene", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
const chipMat = () => memo("chipMat", () => new THREE.MeshStandardMaterial({ color: "#e9dcc6", roughness: 0.9, flatShading: true }));
const chipGeo = () => memo("chipGeo", () => new THREE.IcosahedronGeometry(1, 0));

/** point + normal of a rock surface in the given direction (rock space, before scaling) */
const rockPoint = (geo: THREE.BufferGeometry, dir: THREE.Vector3) => {
  const p = geo.attributes.position;
  const d = dir.clone().normalize();
  const v = new THREE.Vector3();
  let best = -2;
  let bi = 0;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const dot = v.normalize().dot(d);
    if (dot > best) {
      best = dot;
      bi = i;
    }
  }
  return { p: new THREE.Vector3().fromBufferAttribute(p, bi), n: new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, bi) };
};

/** short radial burst of bright points (sparks / dust) */
const Burst: React.FC<{ k: number; origin: THREE.Vector3; color?: string; count?: number; speed?: number; life?: number; size?: number; seed?: number }> = ({
  k,
  origin,
  color = "#ffe27a",
  count = 40,
  speed = 0.09,
  life = 14,
  size = 0.09,
  seed = 1,
}) => {
  const sys = useMemo(() => {
    const r = rng(seed * 57 + 1);
    const dirs = Array.from({ length: count }, () => V(r() - 0.5, r() - 0.3, r() - 0.5).normalize().multiplyScalar(0.4 + r()));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    const m = alphaPoints({ map: softSprite(), size, color, blending: THREE.AdditiveBlending, fog: false });
    return { dirs, g, m };
  }, [count, seed, size, color]);
  if (k < 0 || k > life) return null;
  const pa = sys.g.attributes.position as THREE.BufferAttribute;
  const aa = sys.g.attributes.aAlpha as THREE.BufferAttribute;
  const d = (1 - Math.exp(-k * 0.25)) / 0.25;
  sys.dirs.forEach((v, i) => {
    pa.setXYZ(i, origin.x + v.x * speed * d, origin.y + v.y * speed * d - 0.0015 * k * k, origin.z + v.z * speed * d);
    aa.setX(i, 1 - k / life);
  });
  pa.needsUpdate = aa.needsUpdate = true;
  return <points geometry={sys.g} material={sys.m} frustumCulled={false} renderOrder={12} />;
};

// ---------------------------------------------------------------------------
// Scene 1: the hook. Fish + sand cloud, then up through the surface: the islet
// ---------------------------------------------------------------------------
const fish1 = (f: number) => V(-22 + 0.055 * f, 2.5 + 0.07 * Math.sin(f * 0.11), 0);
const Scene1: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  if (f >= C1_ISLAND) {
    const k = f - C1_ISLAND;
    const h = ip(k, 0, 16, 5, 30, out) + k * 0.05;
    const a = 0.5 + k * 0.006;
    return (
      <>
        <Rig pos={V(Math.sin(a) * h * 0.82, h, Math.cos(a) * h * 0.82)} target={V(0, 0.5, 0)} fov={42} />
        <AerialSet t={t} />
      </>
    );
  }
  const fp = fish1(f);
  let cam: Cam;
  if (f < C1_SAND) {
    // front three-quarter view (the "smile"), swinging round to the side
    const a = ip(f, 0, C1_SAND, 0.42, 1.05, Easing.inOut(Easing.quad));
    const d = ip(f, 0, C1_SAND, 3.0, 3.6);
    cam = { pos: fp.clone().add(V(Math.cos(a) * d, 0.1, Math.sin(a) * d)), target: fp.clone().add(V(0.32, -0.12, 0)) };
  } else if (f < C1_RISE) {
    const k = f - C1_SAND;
    cam = { pos: fp.clone().add(V(-1.4 + k * 0.012, -0.2, 3.0 - k * 0.012)), target: fp.clone().add(V(-1.0, -0.5, 0)) };
  } else {
    const k = ip(f, C1_RISE, C1_ISLAND, 0, 1, Easing.in(Easing.quad));
    cam = {
      pos: fp.clone().add(V(-1.0, -0.25 + 9 * k, 2.7)),
      target: fp.clone().add(V(-0.75, -0.55 + 16 * k, -0.2)),
    };
  }
  cam.pos.add(drift(f));
  const emitter = (time: number) => fish1(time).add(VENT);
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} />
      <CoralField x={fp.x} />
      <Fish t={t} position={fp} open={0.2 + 0.06 * Math.sin(f * 0.2)} look={[0.3, 0]} />
      <SandCloud f={f} from={-70} to={C1_ISLAND} emitter={emitter} count={1500} push={0.03} spread={1.5} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 2: the beak (x-ray), it never stops growing, and it is a pickaxe
// ---------------------------------------------------------------------------
const arrowGeo = () =>
  memo("arrow", () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.07);
    s.lineTo(0.34, 0.07);
    s.lineTo(0.34, 0.17);
    s.lineTo(0.6, 0);
    s.lineTo(0.34, -0.17);
    s.lineTo(0.34, -0.07);
    s.lineTo(0, -0.07);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  });
const P2 = V(-8, 2.6, 0);
const ROCK2 = V(-4.7, 0, 0);
const PITCH2 = -0.5;
const IMPACT2 = V(ROCK2.x - 1.25, 1.02, 0.15);
const tipOffset = (pitch: number) => V(1.032, -0.055, 0).applyAxisAngle(V(0, 0, 1), pitch);
const Scene2: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const G = C2_GROW - S[1];
  const BC = C2_BITE_CUT - S[1];
  const B = C2_BITE - S[1];
  let cam: Cam;
  let fp = P2.clone().add(V(0, 0.04 * Math.sin(f * 0.1), 0));
  let xray = 0;
  let grow = 0;
  let open = 0.4 + 0.12 * Math.sin(f * 0.25);
  let glow = 0;
  if (f < G) {
    // frontal close-up of the mouth: the head turns translucent, the teeth light up
    xray = ip(f, 5, 18, 0, 1);
    glow = xray;
    const d = ip(f, 0, G, 2.5, 1.75, out);
    cam = { pos: fp.clone().add(V(d, 0.02, 0.62 - f * 0.004)), target: fp.clone().add(V(0.9, -0.11, 0)), fov: 28 };
  } else if (f < BC) {
    // side close-up: the beak keeps growing
    xray = 1;
    glow = 1;
    grow = ip(f, G + 3, G + 30, 0, 1, Easing.inOut(Easing.quad));
    open = 0.3;
    const k = f - G;
    cam = { pos: fp.clone().add(V(1.3 + k * 0.002, 0.06, 1.15 - k * 0.003)), target: fp.clone().add(V(0.93, -0.075, 0)), fov: 28 };
  } else {
    // medium shot: the beak hits the coral like a pickaxe
    const lunge = ip(f, B - 9, B, 0, 1, Easing.in(Easing.cubic)) - 0.25 * ip(f, B, B + 10, 0, 1, out);
    fp = IMPACT2.clone().sub(tipOffset(PITCH2)).add(V(-Math.cos(PITCH2), -Math.sin(PITCH2), 0).multiplyScalar(1.0 * (1 - lunge)));
    open = f < B ? ip(f, BC, B - 3, 0.4, 1) : ip(f, B, B + 3, 1, 0.15);
    const k = f - BC;
    cam = {
      pos: IMPACT2.clone().add(V(-0.5 + k * 0.008, 0.7, ip(f, B - 4, B + 3, 6.0, 5.0, out))),
      target: IMPACT2.clone().add(V(-0.55, 0.55, 0)),
      fov: 36,
    };
    cam.pos.add(shake(f, B, 0.12));
  }
  cam.pos.add(drift(f, 0.025));
  const impact = IMPACT2;
  const chips = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 16 }, () => ({ v: V(-0.5 - r() * 0.9, r() * 1.3 - 0.3, (r() - 0.5) * 1.4), s: 0.03 + r() * 0.06, rot: r() * 6 }));
  }, []);
  const day = f >= BC;
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} dim={xray} rays={1 - 0.6 * xray} />
      <CoralField x={fp.x} skip={(i) => Math.abs(i.x - ROCK2.x) < 2.6 && i.z > -5} />
      {day && <Coral item={{ kind: 1, x: ROCK2.x, z: 0, s: 1.7, rot: 0.6, color: "#ff6fa8", seed: 1 }} />}
      <Fish t={t} swim={day ? 0.8 : 0.35} position={fp} rotation={[0, 0, day ? PITCH2 : 0]} open={open} xray={xray} beakGlow={glow} beakGrow={grow} look={[0.4, 0]} />
      {f >= G && f < BC && (
        <group position={fp.clone().add(V(0.84 + 0.04 * grow + 0.015 * Math.sin((f - G) * 0.5), 0.075, 0.1))} scale={0.16 * ip(f, G + 2, G + 10, 0, 1, Easing.out(Easing.back(2)))}>
          <mesh geometry={arrowGeo()} scale={1.16} position={[-0.045, 0, -0.01]}>
            <meshBasicMaterial color="#0b1c22" side={THREE.DoubleSide} fog={false} />
          </mesh>
          <mesh geometry={arrowGeo()}>
            <meshBasicMaterial color="#FFD23F" side={THREE.DoubleSide} fog={false} />
          </mesh>
        </group>
      )}
      {day &&
        f >= B &&
        chips.map((c, i) => {
          const k = f - B;
          const d = (1 - Math.exp(-k * 0.12)) / 0.12;
          return (
            <mesh
              key={i}
              geometry={chipGeo()}
              material={chipMat()}
              position={[impact.x + c.v.x * 0.07 * d, impact.y + c.v.y * 0.07 * d - 0.0012 * k * k, impact.z + c.v.z * 0.07 * d]}
              rotation={[c.rot + k * 0.3, c.rot * 2 + k * 0.2, 0]}
              scale={c.s}
            />
          );
        })}
      {day && <Burst k={f - B} origin={impact} count={50} speed={0.11} size={0.12} />}
      {day && <Burst k={f - B} origin={impact} count={60} speed={0.05} life={30} size={0.2} color="#fff6e0" seed={4} />}
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 3: scraping the algae off the coral... but coral is stone
// ---------------------------------------------------------------------------
const ROCK3 = V(1.5, 1.25, 0);
const R3S = V(1.9, 1.35, 1.6);
export const BITES = [10, 30, 50, 72, 92];
const P3C = V(9, 2.7, 0);
const Scene3: React.FC<{ f: number }> = ({ f: raw }) => {
  const ST = C3_STONE - S[2];
  const CL = C3_CLANK - S[2];
  const B3 = C3_B - S[2];
  // freeze frame (0.3 s) on the clank
  const f = raw < CL ? raw : raw < CL + FREEZE ? CL : raw - FREEZE;
  const t = f / FPS;
  const geo = rockGeometry(3, 1.0);
  const marks = useMemo(
    () =>
      [V(-0.55, 0.8, 0.35), V(-0.3, 0.9, 0.5), V(-0.7, 0.62, 0.55), V(-0.42, 0.75, 0.7), V(-0.15, 0.95, 0.3)].map((d) => {
        const { p, n } = rockPoint(geo, d);
        const wp = p.clone().multiply(R3S).add(ROCK3);
        const wn = n.clone().divide(R3S).normalize();
        return { wp, wn, q: new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), wn) };
      }),
    [geo],
  );
  if (f >= ST) {
    // close-up: the chunk of coral does not give way
    const k = f - ST;
    const bite = ip(f, ST, CL, 0.95, 0.42, Easing.in(Easing.cubic));
    const hit = raw >= CL ? 1 : 0;
    const cam: Cam = {
      pos: P3C.clone().add(V(2.6 - k * 0.005 - 0.25 * hit, 0.12, 2.1 + k * 0.003)),
      target: P3C.clone().add(V(0.82, 0.0, 0)),
      fov: 28,
    };
    cam.pos.add(shake(raw, CL + FREEZE, 0.03, 8));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} />
        <CoralField x={P3C.x} />
        <Fish t={t} swim={0.3} position={P3C} open={bite + 0.04 * pulse(raw, CL + FREEZE + 8, 10)} look={[0.5, -0.2]} worry={hit * 0.7}>
          <mesh geometry={rockGeometry(1, 0.3, 3)} material={rockMat()} position={[1.03, -0.06, 0]} scale={[0.06, 0.05, 0.07]} rotation={[0.3, 0.4, 0]} />
        </Fish>
        <Burst k={raw - CL} origin={P3C.clone().add(V(1.05, -0.055, 0.05))} count={26} speed={0.035} life={12} size={0.07} />
      </>
    );
  }
  // which bite are we in? the fish nods onto the rock
  let bi = 0;
  BITES.forEach((b, i) => {
    if (f >= b - 10) bi = i;
  });
  const m = marks[bi];
  const nod = pulse(f, BITES[bi] - 8, 16);
  const pitch = -0.55;
  const back = V(-Math.cos(pitch), -Math.sin(pitch), 0).multiplyScalar(0.3 * (1 - nod));
  const fp = m.wp.clone().sub(tipOffset(pitch)).add(back).add(V(0, 0, 0.05));
  let cam: Cam;
  if (f < B3) cam = { pos: ROCK3.clone().add(V(-2.6 + f * 0.012, 2.0, 7.0 - f * 0.01)), target: ROCK3.clone().add(V(-1.5, 1.5, 0)), fov: 36 };
  else {
    const k = f - B3;
    cam = { pos: ROCK3.clone().add(V(0.6 - k * 0.01, 2.9, 4.6 - k * 0.006)), target: ROCK3.clone().add(V(-1.2, 1.55, 0.6)), fov: 34 };
  }
  cam.pos.add(drift(f)).add(shake(f, BITES[bi], 0.02, 5));
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} />
      <CoralField x={ROCK3.x} skip={(i) => Math.abs(i.x - ROCK3.x) < 3.4 && i.z > -5} />
      <mesh geometry={geo} material={rockMat()} position={ROCK3} scale={R3S} />
      {/* bite scars: pairs of white grooves */}
      {marks.map((mk, i) =>
        f >= BITES[i] ? (
          <group key={i} position={mk.wp.clone().addScaledVector(mk.wn, 0.012)} quaternion={mk.q}>
            {[-0.035, 0.035].map((z) => (
              <mesh key={z} position={[0, 0, z]} rotation={[0, 0.5 + i * 0.4, 0]} scale={[0.13 * Math.min(1, (f - BITES[i]) / 2 + 0.4), 0.012, 0.026]}>
                <sphereGeometry args={[1, 10, 6]} />
                <meshBasicMaterial color="#fffdf2" />
              </mesh>
            ))}
          </group>
        ) : null,
      )}
      <Fish t={t} swim={0.7} position={fp} rotation={[0, 0, pitch]} open={0.75 - 0.6 * nod} look={[0.5, -0.5]} />
      {BITES.map((b, i) => (
        <Burst key={i} k={f - b} origin={marks[i].wp} count={22} speed={0.04} life={16} size={0.1} color="#dff5c8" seed={i + 2} />
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 4: the second pair of jaws, in the throat: the mill
// ---------------------------------------------------------------------------
const P4 = V(-15, 2.7, 0);
const S_MILL = 0.3; // position of the mill along the gut curve
const Scene4: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const M = C4_MILL - S[3];
  const GR = C4_GRIND - S[3];
  const W = C4_WIDE - S[3];
  const fp = P4.clone().add(V(0, 0.03 * Math.sin(f * 0.09), 0));
  let cam: Cam;
  if (f < M) cam = { pos: fp.clone().add(V(0.52, 0.02, ip(f, 0, M, 3.5, 2.7))), target: fp.clone().add(V(0.52, -0.01, 0)), fov: 30 };
  else if (f < W) {
    const k = f - M;
    cam = { pos: fp.clone().add(V(0.78 - k * 0.002, -0.06, 2.4 - k * 0.0055)), target: fp.clone().add(MILL).add(V(0.09, 0.02, 0)), fov: 28 };
    cam.pos.add(shake(f, GR, 0.012, 40));
  } else {
    const k = f - W;
    const a = 0.25 - k * 0.006;
    cam = { pos: fp.clone().add(V(Math.sin(a) * 6.2, 0.15, Math.cos(a) * 6.2)), target: fp.clone().add(V(0.1, 0.25, 0)), fov: 32 };
  }
  cam.pos.add(drift(f, 0.02));
  const speed = f < GR ? 0.28 : 0.75;
  const phase = f < GR ? f * 0.28 : GR * 0.28 + (f - GR) * speed;
  const glow = ip(f, 24, 36, 0, 1) * (0.7 + 0.3 * Math.sin(f * 0.4));
  const dust = useMemo(() => {
    const N = 220;
    const r = rng(404);
    const rnd = Array.from({ length: N }, () => [r(), r(), r(), r()]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(N), 1));
    return { N, rnd, g, m: alphaPoints({ map: softSprite(), size: 0.028, color: "#fff8e2", blending: THREE.AdditiveBlending, fog: false }) };
  }, []);
  // coral pieces go in whole, come out of the mill as fine powder
  const feed = f >= M - 20;
  const pa = dust.g.attributes.position as THREE.BufferAttribute;
  const aa = dust.g.attributes.aAlpha as THREE.BufferAttribute;
  const start = M + 14;
  for (let i = 0; i < dust.N; i++) {
    const [a, b, c, d] = dust.rnd[i];
    const s = ((f - start) * 0.006 + a) % 1;
    const born = f - start > (1 - a) * 60 || s > a;
    if (f < start || !born) {
      pa.setXYZ(i, 0, -999, 0);
      continue;
    }
    const p = GUT.getPoint(S_MILL + s * (1 - S_MILL));
    pa.setXYZ(i, p.x + (b - 0.5) * 0.05, p.y + (c - 0.5) * 0.05, p.z + (d - 0.5) * 0.05);
    aa.setX(i, Math.min(1, s * 8) * (0.5 + 0.5 * b));
  }
  pa.needsUpdate = aa.needsUpdate = true;
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} dim={0.95} />
      <CoralField x={fp.x} />
      <Fish
        t={t}
        swim={0.3}
        position={fp}
        open={0.3 + 0.25 * Math.max(0, Math.sin(f * 0.3))}
        xray={1}
        xrayReach={ip(f, W - 1, W + 8, 0, 1)}
        beakGlow={0.25}
        millGlow={glow}
        millPhase={phase}
        look={[0.4, 0]}
      >
        {feed &&
          [0, 1, 2, 3, 4].map((k) => {
            const s = (((f - M + 20) * 0.011 + k * 0.2) % 1) * S_MILL;
            const p = GUT.getPoint(s);
            const crush = sat((S_MILL - s) / 0.05);
            return (
              <mesh key={k} geometry={chipGeo()} material={chipMat()} position={p} scale={0.028 * (0.35 + 0.65 * crush) * (0.8 + 0.3 * (k % 2))} rotation={[f * 0.1 + k, f * 0.07, k]} renderOrder={2} />
            );
          })}
        <points geometry={dust.g} material={dust.m} frustumCulled={false} renderOrder={11} />
      </Fish>
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 5: the island factory (sand, globe, 85%, school, aerial x2)
// ---------------------------------------------------------------------------
const fish5 = (f: number) => V(14 + 0.035 * f, 3.0 + 0.05 * Math.sin(f * 0.1), 0);
const PILE = V(30, 0.1, 0);
const SCHOOL = [
  { o: V(0, 0, 0), s: 1 },
  { o: V(-2.6, 0.9, -1.6), s: 0.85 },
  { o: V(-1.9, -1.0, 1.2), s: 0.8 },
  { o: V(-4.6, 0.2, -0.6), s: 0.9 },
  { o: V(-5.6, -0.9, -2.4), s: 0.75 },
];
const Scene5: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const G = C5_GLOBE - S[4];
  const E = C5_85 - S[4];
  const CN = C5_COUNT - S[4];
  const SC = C5_SCHOOL - S[4];
  const A = C5_AERIAL - S[4];
  const F = C5_FACTORY - S[4];
  if (f < G) {
    const fp = fish5(f);
    const k = ip(f, 8, G, 0, 1);
    const cam: Cam = { pos: V(fp.x - 1.0, fp.y - 0.4 - 0.9 * k, 5.6), target: V(fp.x - 1.0 - 0.3 * k, fp.y - 0.8 - 0.7 * k, 0) };
    cam.pos.add(drift(f));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} />
        <CoralField x={fp.x} />
        <Fish t={t} position={fp} look={[0, -0.3]} />
        <SandCloud f={f} from={-50} to={G} emitter={(tm) => fish5(tm).add(VENT)} count={1700} push={0.02} fall={0.05} spread={1.5} seed={5} />
        {[0, 1, 2].map((i) => (
          <Mound key={i} grow={ip(f, 14 + i * 12, 55 + i * 10, 0, 0.55 - i * 0.1)} position={[12.6 + i * 1.15, 0.05, -0.2 + (i % 2) * 0.5]} />
        ))}
      </>
    );
  }
  if (f < E) {
    const PIN = C5_PIN - S[4];
    const spin = ip(f, G, G + 20, 0, 1, out);
    const z = ip(f, G, G + 22, 40, 19.5, out) - (f - G) * 0.03;
    return (
      <>
        <Rig pos={V(0, 1.2, z)} target={V(0, 0.9, 0)} fov={40} />
        <GlobeSet spin={spin} pin={ip(f, PIN, PIN + 7, 0, 1, Easing.out(Easing.back(2.5)))} t={t} />
      </>
    );
  }
  if (f < SC) {
    const k = f - E;
    const grow = ip(f, CN, CN + 34, 0.12, 1, out);
    const cam: Cam = { pos: PILE.clone().add(V(0.9 - k * 0.006, 1.5, 5.4 - k * 0.012)), target: PILE.clone().add(V(-0.25, 1.75, 0)), fov: 36 };
    cam.pos.add(drift(f));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} />
        <CoralField x={PILE.x} skip={(i) => Math.abs(i.x - PILE.x) < 2.5 && i.z > -4.5} />
        <Mound grow={1.5 * grow} position={PILE} />
        <SandCloud f={f} from={E - 50} to={SC} emitter={(tm) => PILE.clone().add(V(0.25 * Math.sin(tm * 0.6), 3.4, 0.2 * Math.cos(tm * 0.45)))} count={1100} push={0} fall={0.06} spread={0.9} seed={8} floorY={0.25} />
      </>
    );
  }
  if (f < A) {
    const k = f - SC;
    const lead = V(40 + 0.07 * k, 3.1, 0);
    const cam: Cam = { pos: V(lead.x - 2.2 + k * 0.02, 2.2, 8.2 - k * 0.02), target: V(lead.x - 2.6, 2.8, -0.5), fov: 38 };
    cam.pos.add(drift(f));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} />
        <CoralField x={lead.x - 2} />
        {SCHOOL.map((sc, i) => {
          const p = lead.clone().add(sc.o).add(V(0, 0.08 * Math.sin(f * 0.1 + i * 2), 0));
          return (
            <React.Fragment key={i}>
              <Fish t={t + i * 0.37} position={p} scale={sc.s} look={[0.3, 0]} />
              <SandCloud
                f={f}
                from={SC - 45}
                to={A}
                emitter={(tm) => V(40 + 0.07 * (tm - SC), 3.1, 0).add(sc.o).add(VENT.clone().multiplyScalar(sc.s))}
                count={420}
                spread={1.4}
                push={0.035}
                fall={0.035}
                seed={20 + i}
              />
            </React.Fragment>
          );
        })}
      </>
    );
  }
  // from above: waves carry the sand to the island, the beach grows
  const grow = ip(f, A + 10, SCENE5_END, 0, 1, Easing.inOut(Easing.quad));
  if (f < F) {
    const k = f - A;
    const h = 60 - k * 0.12;
    return (
      <>
        <Rig pos={V(2 - k * 0.02, h, 20 - k * 0.05)} target={V(0, 0, 3.5)} fov={40} roll={-0.1 + k * 0.001} />
        <AerialSet t={t} grow={grow} sand={ip(f, A, A + 12, 0.3, 1)} />
      </>
    );
  }
  const k = f - F;
  const a = -0.5 + k * 0.006;
  const d = 40 - k * 0.1;
  return (
    <>
      <Rig pos={V(Math.sin(a) * d, 19 - k * 0.03, Math.cos(a) * d)} target={V(0, 2.4, 0)} fov={40} />
      <AerialSet t={t} grow={grow} sand={1} />
    </>
  );
};
const SCENE5_END = S[5] - S[4];

// ---------------------------------------------------------------------------
// Scene 6: night falls, the parasites come out
// ---------------------------------------------------------------------------
const P6 = V(26, 2.6, 0);
const GAP = V(34.1, 1.1, -1.2);
const flank = (x: number, y: number) => V(x, y, sideZ(bodyU(x), y));
const Crevice: React.FC<{ at: THREE.Vector3; s?: number; gap?: number }> = ({ at, s = 1, gap = 0 }) => (
  <group position={at} scale={s}>
    <mesh geometry={rockGeometry(1, 0.35)} material={rockMat()} position={[-1.5 - gap / 2, 0.4, 0]} scale={[1.45, 2.3, 1.5]} />
    <mesh geometry={rockGeometry(2, 0.35)} material={rockMat()} position={[1.5 + gap / 2, 0.3, 0]} scale={[1.45, 2.1, 1.5]} rotation={[0, 2, 0]} />
    <mesh position={[0, 0.6, -0.9]}>
      <planeGeometry args={[3.4, 4.4]} />
      <meshBasicMaterial color="#01040c" fog={false} />
    </mesh>
  </group>
);
const Scene6: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const SW = C6_SWARM - S[5];
  const BL = C6_BLOOD - S[5];
  const DR = C6_DROP - S[5];
  const AR = C6_AROUND - S[5];
  if (f < SW) {
    const night = ip(f, 2, 30, 0, 1, Easing.inOut(Easing.quad));
    const fp = P6.clone().add(V(0.02 * f, 0.05 * Math.sin(f * 0.1), 0));
    const cam: Cam = { pos: fp.clone().add(V(-0.3, 0.5 + f * 0.01, 6.2 + f * 0.035)), target: fp.clone().add(V(0, 0.2, 0)) };
    cam.pos.add(drift(f));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} night={night} />
        <CoralField x={fp.x} />
        <Fish t={t} swim={1 - 0.5 * night} position={fp} look={[0.6 * Math.sin(f * 0.25) * night, 0.3 * night]} worry={night * 0.6} rim={night} />
      </>
    );
  }
  if (f < BL) {
    // out of the cracks, straight at the camera
    const k = f - SW;
    const cam: Cam = { pos: V(GAP.x + 0.2, 1.7, 4.6 - k * 0.022), target: V(GAP.x, 1.5, GAP.z), fov: 40 };
    cam.pos.add(drift(f));
    const pose: SwarmPose = (i, r) => {
      const p = (k - r[0] * 26) / (26 + r[1] * 16);
      if (p < 0) return null;
      const from = GAP.clone().add(V((r[1] - 0.5) * 0.7, (r[2] - 0.2) * 1.6, 0));
      const to = V(cam.pos.x + (r[2] - 0.5) * 3.2, cam.pos.y + (r[3] - 0.5) * 4.6, cam.pos.z + 0.6);
      const e = p * p * 0.5 + p * 0.5;
      const pos = from.clone().lerp(to, e);
      pos.x += 0.12 * Math.sin(k * 0.35 + r[3] * 20);
      pos.y += 0.1 * Math.cos(k * 0.3 + r[0] * 20);
      return { p: pos, dir: to.clone().sub(from).add(V(0.4 * Math.cos(k * 0.35 + r[3] * 20), 0, 0)), s: 0.15 + 0.06 * r[2] };
    };
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} night={1} rays={0.7} />
        <CoralField x={GAP.x} skip={(i) => Math.abs(i.x - GAP.x) < 3.4 && i.z > -4.5} />
        <Crevice at={V(GAP.x, 0.9, GAP.z)} />
        <Swarm count={64} pose={pose} seed={3} />
      </>
    );
  }
  if (f < AR) {
    // macro: one of them on a scale, a tiny red drop
    const k = f - BL;
    const fp = P6.clone().add(V(6, 0, 0));
    const spot = flank(-0.1, 0.04);
    const wp = fp.clone().add(spot);
    const land = ip(f, BL, BL + 10, 0, 1, out);
    const ip0 = wp.clone().add(V(0.02, 0.03, 0.05 + 0.4 * (1 - land)));
    const cam: Cam = { pos: wp.clone().add(V(0.42 - k * 0.003, 0.1, 0.62 - k * 0.004)), target: wp.clone().add(V(0, 0.01, 0)), fov: 26 };
    cam.pos.add(drift(f, 0.006));
    const drop = ip(f, DR, DR + 8, 0, 1, out);
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} night={0.85} rays={0.3} />
        <Fish t={t} swim={0.15} position={fp} worry={1} rim={0.6} />
        <Isopod position={ip0} rotation={[0, Math.PI / 2 + 0.25, 0.5 + 0.06 * Math.sin(f * 0.8)]} scale={0.12} />
        <pointLight position={wp.clone().add(V(0.2, 0.2, 0.5))} intensity={0.5} color="#bcd4ff" distance={2} />
        {drop > 0 && (
          <mesh position={wp.clone().add(V(-0.012, -0.015 - 0.01 * drop, 0.012))} scale={0.016 * drop}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color="#e8182c" roughness={0.15} emissive="#7a0010" emissiveIntensity={0.6} />
          </mesh>
        )}
      </>
    );
  }
  // they surround the fish
  const k = f - AR;
  const fp = P6.clone().add(V(12, 0, 0));
  const a = 0.2 + k * 0.008;
  const cam: Cam = { pos: fp.clone().add(V(Math.sin(a) * 5.6, 0.5, Math.cos(a) * 5.6)), target: fp.clone() };
  cam.pos.add(drift(f));
  const pose: SwarmPose = (i, r) => {
    const rad = ip(k, 0, 40, 3.6, 1.55 + r[1] * 0.7, out);
    const ang = r[0] * 6.28 + k * 0.035 * (r[2] > 0.5 ? 1 : -1);
    const tilt = (r[3] - 0.5) * 2.2;
    const p = V(Math.cos(ang) * rad * 1.15, Math.sin(ang) * rad * Math.cos(tilt) * 0.75, Math.sin(ang) * rad * Math.sin(tilt) * 0.8 + 0.2);
    return { p: fp.clone().add(p), dir: p.clone().negate(), s: 0.2 + 0.07 * r[2] };
  };
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.7} />
      <CoralField x={fp.x} />
      <Fish t={t} swim={0.5} position={fp} look={[0.7 * Math.sin(f * 0.5), 0.4 * Math.cos(f * 0.37)]} worry={1} open={0.4} rim={1} />
      <Swarm count={46} pose={pose} seed={6} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 7: the cleaner fish helps by day... and sleeps at night
// ---------------------------------------------------------------------------
const P7 = V(-32, 2.7, 0);
const TICKS = [flank(-0.25, 0.1), flank(0.05, -0.1), flank(-0.5, -0.04), flank(0.2, 0.15), flank(-0.1, 0.18)];
export const PECKS = [12, 28, 44, 62, 80];
const NEST = V(-44, 0, 0);
const Scene7: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const B7 = C7_B - S[6];
  const N7 = C7_NIGHT - S[6];
  if (f < N7) {
    const fp = P7.clone().add(V(0, 0.04 * Math.sin(f * 0.08), 0));
    let pi = 0;
    PECKS.forEach((p, i) => {
      if (f >= p - 9) pi = i;
    });
    const peck = pulse(f, PECKS[pi] - 6, 12);
    const head = V(0.9, 0.1, -0.42).normalize();
    const cp = fp.clone().add(TICKS[pi]).add(V(0, 0, 0.03)).addScaledVector(head, -(0.34 + 0.14 * (1 - peck)));
    const cam: Cam =
      f < B7
        ? { pos: fp.clone().add(V(0.5 - f * 0.006, 0.25, 4.3 - f * 0.012)), target: fp.clone().add(V(-0.1, 0, 0.3)), fov: 36 }
        : { pos: fp.clone().add(V(-1.7 + (f - B7) * 0.008, 0.5, 3.1 - (f - B7) * 0.006)), target: fp.clone().add(V(-0.1, 0.05, 0.3)), fov: 34 };
    cam.pos.add(drift(f));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} />
        <CoralField x={fp.x} />
        <Fish t={t} swim={0.2} position={fp} open={0.3} look={[-0.2, 0.1]} />
        {TICKS.map((p, i) =>
          f < PECKS[i] ? <Isopod key={i} position={fp.clone().add(p).add(V(0, 0, 0.012))} rotation={[0, 0.4 + i, 1.2]} scale={0.075} /> : null,
        )}
        <Cleaner t={t} position={cp} rotation={[0, Math.atan2(-head.z, head.x), Math.asin(head.y)]} scale={0.62} />
        {PECKS.map((p, i) => (
          <Burst key={i} k={f - p} origin={fp.clone().add(TICKS[i])} count={10} speed={0.02} life={10} size={0.06} color="#ffffff" seed={i + 9} />
        ))}
      </>
    );
  }
  // night: the cleaner sleeps in a crack, the parrotfish is on its own
  const k = f - N7;
  const bed = NEST.clone().add(V(0, 1.12, 2.0));
  const fp = NEST.clone().add(V(0.9, 2.05 + 0.04 * Math.sin(f * 0.08), -1.6));
  const cam: Cam = { pos: NEST.clone().add(V(-0.5 + k * 0.006, 1.7, 4.5 - k * 0.008)), target: NEST.clone().add(V(0.25, 0.9 + k * 0.002, 1.0)), fov: 44 };
  cam.pos.add(drift(f, 0.02));
  const pose: SwarmPose = (i, r) => {
    const p = ip(k, 0, 70, 0, 1, Easing.linear);
    const from = fp.clone().add(V(5 + r[0] * 3, (r[1] - 0.5) * 4, -1 - r[2] * 3));
    const to = fp.clone().add(V(1.6 + r[0] * 1.3, (r[1] - 0.5) * 1.6, -0.3 - r[2]));
    const pos = from.clone().lerp(to, p);
    pos.y += 0.1 * Math.sin(k * 0.3 + r[3] * 20);
    return { p: pos, dir: to.clone().sub(from), s: 0.13 + 0.05 * r[2] };
  };
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.7} />
      <CoralField x={NEST.x} skip={(i) => Math.abs(i.x - NEST.x) < 3 && i.z > -1} />
      <mesh geometry={rockGeometry(2, 0.5)} material={rockMat()} position={NEST.clone().add(V(-0.75, 0.55, 1.9))} scale={[0.75, 0.85, 0.8]} />
      <mesh geometry={rockGeometry(3, 0.5)} material={rockMat()} position={NEST.clone().add(V(0.75, 0.5, 1.9))} scale={[0.7, 0.75, 0.8]} rotation={[0, 1.4, 0]} />
      <mesh geometry={rockGeometry(1, 0.5)} material={rockMat()} position={NEST.clone().add(V(0, 0.0, 1.6))} scale={[1.2, 0.5, 0.7]} />
      <Cleaner t={t} swim={0.04} asleep position={bed} rotation={[0, 0.25, -0.12 + 0.02 * Math.sin(f * 0.1)]} scale={0.8} />
      <pointLight position={bed.clone().add(V(0, 0.8, 1))} intensity={0.9} color="#cfe0ff" distance={4} />
      <Bubbles t={k / FPS} origin={[bed.x + 0.35, bed.y + 0.2, bed.z]} count={3} rate={1.6} size={0.34} letter="z" spreadX={0.25} seed={2} />
      <Fish t={t} swim={0.3} position={fp} rotation={[0, Math.PI + 0.5, 0]} look={[0.3, -0.5]} worry={0.8} open={0.2} rim={1} />
      <Swarm count={16} pose={pose} seed={12} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scenes 8-9 (background): the fish faces the camera, the eyes close in
// ---------------------------------------------------------------------------
const P8 = V(46, 2.7, 0);
const Scene89: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const fp = P8.clone().add(V(0.004 * f, 0.05 * Math.sin(f * 0.09), 0));
  // in profile, lit by the moon: it stays readable behind the cards
  const a = 0.28 - f * 0.0012;
  const d = ip(f, 0, 46, 6.4, 5.2, out) - f * 0.002;
  const cam: Cam = { pos: fp.clone().add(V(Math.sin(a) * d, 0.25, Math.cos(a) * d)), target: fp.clone().add(V(0.05, -0.45, 0)), fov: 36 };
  cam.pos.add(drift(f, 0.03));
  const pose: SwarmPose = (i, r) => {
    const rad = 2.5 + r[1] * 2.0 - Math.min(1.0, f * 0.004);
    const ang = r[0] * 6.28 + f * 0.012 * (r[2] > 0.5 ? 1 : -1);
    const p = V(Math.cos(ang) * rad * 1.1, Math.sin(ang) * rad * 0.8 + 0.1, -1.6 + r[3] * 2.6);
    return { p: fp.clone().add(p), dir: p.clone().negate(), s: 0.14 + 0.05 * r[2] };
  };
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.8} />
      <CoralField x={fp.x} />
      <Fish t={t} swim={0.45} position={fp} look={[0.5 * Math.sin(f * 0.21), 0.3 * Math.cos(f * 0.17)]} worry={0.9} open={0.3} rim={1} />
      <Swarm count={34} pose={pose} seed={21} />
    </>
  );
};

/** model sheet for approvals: frame 0 = side, frame 1 = front */
export const FishSheet: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ok = useAssets();
  if (!ok) return null;
  const fp = V(-8, 2.6, 0);
  const cam: Cam =
    frame === 0
      ? { pos: fp.clone().add(V(0.05, 0.05, 6.6)), target: fp.clone().add(V(-0.1, 0, 0)), fov: 36 }
      : { pos: fp.clone().add(V(3.4, 0.0, 0.45)), target: fp.clone().add(V(0.6, -0.02, 0)), fov: 30 };
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 36, near: 0.05, far: 600 }} gl={{ antialias: true }}>
      <Rig {...cam} />
      <ReefEnv t={0.4} cam={cam.pos} />
      <CoralField x={fp.x} />
      <Fish t={0.4} swim={0.3} position={fp} open={0.2} look={frame === 0 ? [0.3, 0] : [0, 0]} />
    </ThreeCanvas>
  );
};

export const PapagaioScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ok = useAssets();
  const sc = sceneOf(frame);
  const f = frame - S[sc];
  if (!ok) return null;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: 40, near: 0.05, far: 600, position: [0, 2, 8] }}
      gl={{ antialias: true, toneMappingExposure: 1.0 }}
      style={{ backgroundColor: "#0b84ad" }}
    >
      {sc === 0 && <Scene1 f={f} />}
      {sc === 1 && <Scene2 f={f} />}
      {sc === 2 && <Scene3 f={f} />}
      {sc === 3 && <Scene4 f={f} />}
      {sc === 4 && <Scene5 f={f} />}
      {sc === 5 && <Scene6 f={f} />}
      {sc === 6 && <Scene7 f={f} />}
      {sc >= 7 && <Scene89 f={frame - S[7]} />}
    </ThreeCanvas>
  );
};

// ---------------------------------------------------------------------------
// The two choice cards (their own small canvases) and the warning fly-by
// ---------------------------------------------------------------------------
const cocoonMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uEdge: { value: 2 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uTime;
      void main(){ vP = position; vec3 p = position * (1.0 + 0.025 * sin(position.x * 9.0 + uTime * 3.0) * sin(position.y * 11.0 + uTime * 2.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uEdge; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ if (vP.x < uEdge) discard;
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float rim = smoothstep(0.1, 0.0, vP.x - uEdge);
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (f * 1.2 + vP.y * 1.5 + uTime * 0.2) + vec3(0.0, 2.1, 4.2));
        vec3 col = mix(vec3(0.75, 1.0, 0.98), irid, 0.35) + rim * 0.6;
        gl_FragColor = vec4(col, 0.12 + 0.75 * f + rim * 0.5); }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

const CardA: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const mat = useMemo(cocoonMat, []);
  const k = f - C8_A;
  const total = DURATION - C8_A;
  // only the beginning: by the end of the video the bubble covers just the head
  const prog = ip(k, 14, total, 0, 1, Easing.out(Easing.quad));
  mat.uniforms.uEdge.value = 1.3 - 0.95 * prog;
  mat.uniforms.uTime.value = t;
  const fp = V(0, 2.6 + 0.03 * Math.sin(f * 0.08), 0);
  const a = 0.75 - k * 0.0012;
  const cam: Cam = { pos: fp.clone().add(V(Math.sin(a) * 4.3 + 0.2, 0.15, Math.cos(a) * 4.3)), target: fp.clone().add(V(0.15, 0, 0)), fov: 34 };
  const blow = ip(k, 0, 16, 0, 1, out);
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.6} />
      <CoralField x={0} />
      <Fish t={t} swim={0.25} position={fp} open={0.55 + 0.1 * Math.sin(f * 0.3)} look={[0.3, 0]} worry={0.3} rim={1} />
      <mesh position={fp.clone().add(V(1.04 + 0.08 * blow, -0.055, 0))} scale={0.15 * blow * (1 - 0.5 * prog)}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshPhysicalMaterial color="#d8fffb" transparent opacity={0.4} roughness={0.05} depthWrite={false} emissive="#7fe9e0" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={fp.clone().add(V(0.02, 0, 0))} material={mat} scale={[1.3, 0.56, 0.42]} renderOrder={20}>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>
      <pointLight position={fp.clone().add(V(1.6, 0.6, 1.6))} intensity={2.2} color="#bffcff" distance={6} />
    </>
  );
};

const CardB: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const k = f - C8_B;
  const total = DURATION - C8_B;
  const go = ip(k, 4, total, 0, 1, Easing.out(Easing.quad));
  const fp = V(-1.5 + 2.2 * go, 2.2 + 0.03 * Math.sin(f * 0.1), 1.0 - 2.7 * go);
  const cam: Cam = { pos: V(-1.2 + k * 0.004, 2.6, 6.6 - k * 0.006), target: V(-0.1, 2.15, -0.8), fov: 34 };
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.6} />
      <CoralField x={0} skip={(i) => Math.abs(i.x) < 4 && i.z > -5} />
      <Crevice at={V(0.9, 1.3, -2.4)} s={1.25} gap={0.8} />
      <Fish t={t} swim={0.7} position={fp} rotation={[0, 0.88, 0]} look={[0.5, 0]} worry={0.5} rim={1} />
      <pointLight position={[-2, 3.5, 3]} intensity={2.5} color="#bcd0ff" distance={9} />
    </>
  );
};

export const CardCanvas: React.FC<{ which: "A" | "B"; width: number; height: number }> = ({ which, width, height }) => {
  const frame = useCurrentFrame();
  const ok = useAssets();
  if (!ok) return null;
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 34, near: 0.05, far: 400 }} gl={{ antialias: true }} style={{ backgroundColor: "#0a1f4c" }}>
      {which === "A" ? <CardA f={frame} /> : <CardB f={frame} />}
    </ThreeCanvas>
  );
};

/** scene 9: the parasites streak past the lens (transparent canvas on top of everything) */
export const WarnCanvas: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ok = useAssets();
  const k = frame - C9_WARN;
  if (!ok || k < -2) return null;
  const pose: SwarmPose = (i, r) => {
    const p = (k - r[0] * 14) / 13;
    if (p < 0 || p > 1.2) return null;
    const from = V(-2.6 - r[1], -2.6 + r[2] * 5.2, 0.4 + r[3] * 1.6);
    const to = V(2.8 + r[1], from.y + (r[3] - 0.5) * 2.2, 2.2 + r[2] * 1.2);
    return { p: from.clone().lerp(to, p), dir: to.clone().sub(from), s: 0.55 + 0.5 * r[2] };
  };
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 40, near: 0.05, far: 100, position: [0, 0, 5] }} gl={{ antialias: true, alpha: true }} style={{ position: "absolute", inset: 0 }}>
      <Rig pos={V(0, 0, 5)} target={V(0, 0, 0)} />
      <ambientLight intensity={0.7} color="#9fb8ff" />
      <directionalLight position={[2, 3, 5]} intensity={1.6} color="#cfe0ff" />
      <Swarm count={22} pose={pose} seed={33} glow={0.9} />
    </ThreeCanvas>
  );
};
