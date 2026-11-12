// "Peixe-papagaio – parte 2/3": all the 3D shots. Same world, fish, reef, parasites and night as parte 1
// (imported from ../papagaio, unchanged). The camera is never in front of the fish: side or 3/4 only.
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { bodyU, Fish, sideZ, VENT } from "../papagaio/Fish";
import { alphaPoints, bubbleSprite, clamp, fbm3, memo, rng, softSprite, V } from "../papagaio/gfx";
import { useAssets } from "../papagaio/Globe";
import { AerialSet } from "../papagaio/Island";
import { Coral, CoralField, Isopod, ReefEnv, rockGeometry, SandCloud, Swarm, SwarmPose } from "../papagaio/Reef";
import { bagPoint, Cocoon, Hit, SlimeOoze } from "./Cocoon";
import {
  C1_ISLAND,
  C1_NIGHT,
  C1_SAND,
  C2_CLOSED,
  C2_COVER,
  C2_HOUR,
  C2_PUSH,
  C2_SOLTA,
  C3_HIT,
  C3_SIDE,
  C4_10,
  C4_95,
  C4_ANGLE,
  C4_BACK,
  C5_OUT,
  C6_CLOSE,
  C6_GROWL,
  C6_LEAVE,
  C7_A,
  C7_B,
  COUNT10_FRAMES,
  COUNT95_FRAMES,
  DURATION,
  FPS,
  HITS,
  S,
  sceneOf,
} from "./timeline";

const io = Easing.inOut(Easing.cubic);
const out = Easing.out(Easing.cubic);
const ip = (f: number, a: number, b: number, x: number, y: number, e: (n: number) => number = io) =>
  interpolate(f, [a, b], [x, y], { ...clamp, easing: e });

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
/** camera around the fish: a = angle from its side (0 = pure profile, + = towards the snout: 3/4).
 *  Clamped so it never gets in front of the fish. */
const orbit = (fp: THREE.Vector3, a: number, d: number, h: number, look = V(0, 0, 0), fov = 36): Cam => {
  const aa = Math.max(-1.0, Math.min(0.95, a));
  return { pos: fp.clone().add(V(Math.sin(aa) * d, h, Math.cos(aa) * d)), target: fp.clone().add(look), fov };
};

const rockMat = () => memo("rockMatScene2", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
const flank = (x: number, y: number) => V(x, y, sideZ(bodyU(x), y));

// --- the sea floor height (same formula as the floor mesh in ReefEnv) so the fish rests ON the sand ---
const floorAt = (wx: number, wz: number, camX: number) => {
  const lx = wx - Math.round(camX / 20) * 20;
  const lz = wz + 8;
  return 0.5 * (fbm3(lx * 0.18, 0, lz * 0.18) - 0.5) + 0.05 * Math.sin(lx * 2.2 + lz * 0.7);
};

// ---------------------------------------------------------------------------
// The bed: the fish sleeps on the bottom, leaning on a coral rock (as in the real photos)
// ---------------------------------------------------------------------------
const BED_X = 2;
const BED_Z = 0.3;
const BED_Y = floorAt(BED_X, BED_Z, 0) + 0.4;
const BED = V(BED_X, BED_Y, BED_Z);
const LEAN: [number, number, number] = [-0.13, 0, -0.03];
const bedSkip = (i: { x: number; z: number }) => Math.abs(i.x - BED_X) < 3.2 && i.z > 1;
const BedSet: React.FC = () => (
  <>
    <mesh geometry={rockGeometry(2, 0.75)} material={rockMat()} position={[BED_X - 0.15, BED_Y - 0.2, BED_Z - 1.05]} scale={[1.75, 0.95, 0.75]} rotation={[0, 0.2, 0]} />
    <mesh geometry={rockGeometry(3, 0.6)} material={rockMat()} position={[BED_X + 1.55, BED_Y - 0.3, BED_Z - 0.75]} scale={[0.7, 0.6, 0.65]} />
    <Coral item={{ kind: 1, x: BED_X - 2.1, z: BED_Z - 0.5, s: 0.85, rot: 0.4, color: "#c96fa8", seed: 2 }} />
  </>
);

/** the sleeping fish (+ cocoon) on its bed */
const Sleeper: React.FC<{ t: number; cover: number; hits?: Hit[]; night?: number; ooze?: number; children?: React.ReactNode; shift?: THREE.Vector3; tear?: number }> = ({
  t,
  cover,
  hits,
  night = 1,
  ooze = -1,
  children,
  shift,
  tear = 0,
}) => (
  <group position={BED} rotation={LEAN}>
    <Fish t={t} swim={0.08} position={shift ?? V(0, 0, 0)} open={0.28} look={[0.1, -0.25]} rim={night} />
    {ooze >= 0 && <SlimeOoze k={ooze} />}
    <Cocoon t={t} cover={cover} hits={hits} night={night} tear={tear} />
    {children}
  </group>
);

/** sleeping "z"s: they rise only a little, just above the fish, so they stay inside the safe area */
const SleepZ: React.FC<{ f: number }> = ({ f }) => (
  <group>
    {[0, 1, 2].map((i) => {
      const life = ((f + i * 20) % 60) / 60;
      const s = 0.12 + 0.12 * life;
      const p = BED.clone().add(V(0.05 + 0.12 * life + 0.03 * Math.sin(life * 9 + i), 0.5 + 0.55 * life, 0.35));
      return (
        <sprite key={i} position={p} scale={[s, s, s]} renderOrder={22}>
          <spriteMaterial map={bubbleSprite("z")} transparent opacity={Math.min(1, life * 5) * (1 - life) * 1.4} depthWrite={false} />
        </sprite>
      );
    })}
  </group>
);
// ---------------------------------------------------------------------------
// Scene 1: recap by day (islands from poop), then the night of the vote
// ---------------------------------------------------------------------------
const fish1 = (f: number) => V(-22 + 0.055 * f, 2.5 + 0.07 * Math.sin(f * 0.11), 0);
const Scene1: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const ISL = C1_ISLAND - S[0];
  const SND = C1_SAND - S[0];
  const NGT = C1_NIGHT - S[0];
  if (f >= NGT) {
    // night: the fish glides over its bed, lit by the moon (the vote result plays on top)
    const k = f - NGT;
    const fp = BED.clone().add(V(-1.6 + k * 0.012, 0.75 + 0.04 * Math.sin(k * 0.1), 0));
    const cam = orbit(fp, 0.35 - k * 0.003, ip(k, 0, 20, 6.5, 7.5, out), 0.6, V(0.1, -0.2, 0), 38);
    cam.pos.add(drift(f, 0.03));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} night={ip(k, 0, 5, 0.6, 1)} rays={0.7} />
        <CoralField x={BED_X} skip={bedSkip} />
        <BedSet />
        <Fish t={t} swim={0.4} position={fp} look={[0.3, -0.2]} rim={1} open={0.25} />
      </>
    );
  }
  if (f >= ISL && f < SND) {
    // the islet, from above
    const k = f - ISL;
    const h = 26 - k * 0.12;
    const a = 0.6 + k * 0.006;
    return (
      <>
        <Rig pos={V(Math.sin(a) * h * 0.8, h, Math.cos(a) * h * 0.8)} target={V(0, 0.5, 0)} fov={42} />
        <AerialSet t={t} grow={0.5} sand={0.8} />
      </>
    );
  }
  const fp = fish1(f);
  let cam: Cam;
  if (f < ISL) {
    // 3/4 swinging round to the side, the trail of sand behind it
    const a = ip(f, 0, ISL, 0.8, 0.2, Easing.inOut(Easing.quad));
    cam = orbit(fp, a, ip(f, 0, ISL, 3.6, 4.2), 0.2, V(ip(f, 0, ISL, 0.4, -0.2), -0.1, 0), 40);
  } else {
    // close on the grains coming out near the tail
    const k = f - SND;
    cam = { pos: fp.clone().add(V(-1.5 + k * 0.012, -0.25, 2.6 - k * 0.012)), target: fp.clone().add(V(-1.1, -0.5, 0)), fov: 40 };
  }
  cam.pos.add(drift(f));
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} />
      <CoralField x={fp.x} />
      <Fish t={t} position={fp} open={0.2 + 0.06 * Math.sin(f * 0.2)} look={[0.3, 0]} />
      <SandCloud f={f} from={-70} to={NGT} emitter={(tm) => fish1(tm).add(VENT)} count={2600} push={0.03} spread={1.5} size={1.8} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 2: the slime sleeping bag
// ---------------------------------------------------------------------------
const Scene2: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const SO = C2_SOLTA - S[1];
  const CO = C2_COVER - S[1];
  const HR = C2_HOUR - S[1];
  const CL = C2_CLOSED - S[1];
  const PU = C2_PUSH - S[1];
  // the film: starts at the mouth, over the head, then all the way to the tail (closed on "bolha")
  const cover = f < SO + 6 ? 0 : f < CO ? ip(f, SO + 6, CO, 0.0, 0.2, Easing.linear) : ip(f, CO, CL, 0.2, 1, Easing.inOut(Easing.quad));
  let cam: Cam;
  const settle = ip(f, 0, SO - 4, 0, 1, Easing.out(Easing.quad));
  if (f < SO) {
    // wide 3/4: it glides down and settles on the sand against the rock
    cam = orbit(BED, 0.5 - f * 0.003, 8.5 - f * 0.01, 1.4, V(0, -0.25, -0.2), 38);
  } else if (f < CO) {
    // close on the head, side: the slime comes out of the mouth
    const k = f - SO;
    cam = orbit(BED.clone().add(V(0.7, 0, 0)), 0.42 - k * 0.002, 3.4 - k * 0.004, 0.15, V(0, 0.1, 0), 34);
  } else if (f < HR) {
    // medium, side: the film spreads along the body
    const k = f - CO;
    cam = orbit(BED.clone().add(V(0.2 - k * 0.008, 0, 0)), 0.1, 6.2, 0.6, V(0, -0.25, 0), 38);
  } else if (f < PU) {
    // slow 3/4 orbit while the bag closes
    const k = f - HR;
    cam = orbit(BED, -0.35 + k * 0.006, 7.6 - k * 0.006, 1.3, V(-0.1, -0.25, 0), 38);
  } else {
    // push in on the closed bag
    const k = f - PU;
    cam = orbit(BED, 0.3 - k * 0.002, ip(k, 0, 40, 7.4, 5.4, out), 0.7, V(-0.05, -0.25, 0), 38);
  }
  cam.pos.add(drift(f, 0.025));
  const shift = V(-0.6 * (1 - settle), 0.9 * (1 - settle) ** 2, 0);
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.7} />
      <CoralField x={BED_X} skip={bedSkip} />
      <BedSet />
      <Sleeper t={t} cover={cover} shift={shift} ooze={f >= SO ? f - SO : -1} />
      <pointLight position={BED.clone().add(V(0.8, 1.6, 1.8))} intensity={1.1} color="#cfe0ff" distance={5} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 3: the parasites arrive... and bounce off the bag
// ---------------------------------------------------------------------------
// where each parasite hits the bag (fish space, on the side the camera sees)
// on the RIM of the bag as the camera sees it (above the back, in front of the snout): outside the fish's silhouette
const TARGETS = [V(0.45, 1.0, 0.3), V(-0.55, 1.0, 0.3), V(1.6, 0.15, 0.3), V(0.0, 1.0, 0.3), V(1.15, 0.75, 0.3), V(-1.0, 0.95, 0.3)].map((d) =>
  bagPoint(d.x, d.y, d.z),
);
const BED_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...LEAN));
const toWorld = (p: THREE.Vector3) => p.clone().applyQuaternion(BED_Q).add(BED);
/** bump: frames relative to the hit -> distance from the film (approach, contact, bounce back) */
const bumpDist = (k: number) => (k < 0 ? Math.min(1.6, 0.05 - k * 0.06) : 0.75 * (1 - Math.exp(-k * 0.2)) + 0.02);
/** the hits as uniforms for the bag's glints */
const hitsAt = (f: number, frames: number[], len = 14): Hit[] =>
  frames.map((h, i) => ({ p: TARGETS[i % TARGETS.length].p, k: (f - h) / len })).filter((h) => h.k >= 0 && h.k <= 1);

const bumpPose = (f: number, frames: number[], extra: number): SwarmPose => (i, r) => {
  if (i < frames.length) {
    const tg = TARGETS[i % TARGETS.length];
    const k = f - frames[i];
    const d = bumpDist(k);
    const wob = V(0.05 * Math.sin(f * 0.4 + i), 0.05 * Math.cos(f * 0.33 + i * 2), 0);
    const dirOut = tg.n.clone().add(V(0.25 * (r[0] - 0.5), 0.15, 0.08)).normalize();
    const p = toWorld(tg.p.clone().addScaledVector(dirOut, d).add(wob));
    const face = toWorld(tg.p).sub(p);
    const spin = k > 0 && k < 18 ? V(Math.sin(k * 0.8), Math.cos(k * 0.8), 0).multiplyScalar(0.6) : V(0, 0, 0);
    return { p, dir: (k > 0 && k < 10 ? face.negate() : face).add(spin), s: 0.17 + 0.04 * r[2] };
  }
  // the others hover around, waiting
  const ang = r[0] * 6.28 + f * 0.03 * (r[2] > 0.5 ? 1 : -1);
  const rad = 1.9 + r[1] * 1.2 - extra;
  const p = BED.clone().add(V(Math.cos(ang) * rad * 1.1, 0.4 + Math.sin(ang * 1.3) * 0.5 + r[3] * 0.6, 0.9 + Math.sin(ang) * rad * 0.6));
  return { p, dir: BED.clone().sub(p).add(V(Math.cos(ang + 1.5), 0, Math.sin(ang + 1.5))), s: 0.15 + 0.05 * r[2] };
};

const Scene3: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const SI = C3_SIDE - S[2];
  const HT = C3_HIT - S[2];
  const hitFrames = HITS.map((h) => h - S[2]);
  if (f < SI) {
    // out of the cracks of the rock behind the sleeping fish, heading for it
    const cam = orbit(BED, -0.45 + f * 0.004, 8.0 - f * 0.012, 1.5, V(0, -0.2, -0.3), 38);
    cam.pos.add(drift(f));
    const cracks = [V(-1.9, 0.25, -1.25), V(1.3, 0.45, -1.35), V(2.1, 0.0, -0.9), V(-1.2, 0.7, -1.5)];
    const pose: SwarmPose = (i, r) => {
      const p = (f - r[0] * 16) / 42;
      if (p < 0) return null;
      const from = BED.clone().add(cracks[i % cracks.length]).add(V((r[1] - 0.5) * 0.3, (r[2] - 0.5) * 0.3, 0));
      const to = BED.clone().add(V(-1.4 + r[3] * 2.8, 0.3 + r[2] * 1.0, 0.7 + r[1] * 0.9));
      const pos = from.clone().lerp(to, Math.min(1, p) ** 0.8);
      pos.y += 0.1 * Math.sin(f * 0.35 + r[3] * 20);
      return { p: pos, dir: to.clone().sub(from).add(V(0, 0.3 * Math.cos(f * 0.3 + r[0] * 9), 0)), s: 0.16 + 0.05 * r[2] };
    };
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} night={1} rays={0.6} />
        <CoralField x={BED_X} skip={bedSkip} />
        <BedSet />
        <Sleeper t={t} cover={1} />
        <Swarm eyes="dark" count={32} pose={pose} seed={3} />
        <pointLight position={BED.clone().add(V(0.6, 1.4, 1.8))} intensity={1.0} color="#cfe0ff" distance={5} />
      </>
    );
  }
  const close = f >= HT;
  const cam = close ? orbit(BED, 0.15 - (f - HT) * 0.002, 7.0 - (f - HT) * 0.006, 0.45, V(0.1, -0.15, 0), 38) : orbit(BED, -0.3 + (f - SI) * 0.004, 7.8 - (f - SI) * 0.01, 1.2, V(0, -0.25, 0), 38);
  cam.pos.add(drift(f, 0.025));
  // before the close-up they close in; then they hit the film one after another and bounce off
  const frames = close ? hitFrames : hitFrames.map((h) => h + 40);
  const extra = ip(f, SI, HT, 0, 0.8);
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.7} />
      <CoralField x={BED_X} skip={bedSkip} />
      <BedSet />
      <Sleeper t={t} cover={1} hits={hitsAt(f, frames).map((h) => h)} />
      <Swarm eyes="dark" count={22} pose={bumpPose(f, frames, extra)} seed={8} />
      <SleepZ f={f} />
      <pointLight position={BED.clone().add(V(0.6, 1.4, 1.8))} intensity={1.0} color="#cfe0ff" distance={5} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 4: the experiment, split screen (each half has its own canvas), then the battery
// ---------------------------------------------------------------------------
const MARKS = [
  flank(-0.2, 0.08),
  flank(0.15, -0.05),
  flank(-0.45, -0.02),
  flank(0.35, 0.12),
  flank(-0.05, 0.2),
  flank(-0.6, 0.06),
  flank(0.05, -0.16),
  flank(-0.32, 0.2),
  flank(0.48, -0.06),
  flank(-0.15, -0.18),
  flank(0.25, 0.22),
  flank(-0.5, -0.14),
];
const markMat = () => memo("biteMark", () => new THREE.MeshStandardMaterial({ color: "#e0262f", roughness: 0.5, emissive: "#6a0008", emissiveIntensity: 0.5 }));
const SplitHalf: React.FC<{ side: "L" | "R"; f: number }> = ({ side, f }) => {
  const t = f / FPS;
  const fp = V(0, 2.6 + 0.03 * Math.sin(f * 0.08), 0);
  const F = f + S[3]; // absolute frame, for the cues
  const second = F >= C4_ANGLE;
  const cam = second ? orbit(fp, 0.05 + (F - C4_ANGLE) * 0.002, 7.6, 0.3, V(-0.1, 0.15, 0), 40) : orbit(fp, 0.55 - f * 0.002, 8.2, 0.7, V(0.1, 0.2, 0), 40);
  cam.pos.add(drift(f, 0.03));
  if (side === "L") {
    // no bag: parasites stuck on the flank, little red marks appear as the counter runs to 95
    const n = Math.round(ip(F, C4_95 - 4, C4_95 + COUNT95_FRAMES, 0, MARKS.length, Easing.out(Easing.quad)));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} night={1} rays={0.6} />
        <CoralField x={0} />
        <group position={fp}>
          <Fish t={t} swim={0.35} open={0.35} look={[0.4 * Math.sin(f * 0.3), 0.2]} worry={1} rim={1} />
          {MARKS.map((m, i) =>
            i < n ? (
              <group key={i}>
                <mesh position={m.clone().add(V(0, 0, 0.004))} scale={[0.085, 0.065, 0.016]} material={markMat()}>
                  <sphereGeometry args={[1, 12, 8]} />
                </mesh>
                {i < 5 && <Isopod eyes="dark" position={m.clone().add(V(0.03, 0.04, 0.06))} rotation={[0, 0.3 + i, 1.2]} scale={0.36} />}
              </group>
            ) : null,
          )}
        </group>
        <Swarm eyes="dark"
          count={14}
          seed={11}
          pose={(i, r) => {
            const ang = r[0] * 6.28 + f * 0.05;
            const rad = 1.3 + r[1] * 0.9;
            const p = fp.clone().add(V(Math.cos(ang) * rad * 1.2, Math.sin(ang) * rad * 0.6 + 0.1, 0.4 + r[2]));
            return { p, dir: fp.clone().sub(p), s: 0.2 };
          }}
        />
      </>
    );
  }
  // in the bag: they bump and bounce off, almost no marks (one at 10%)
  const frames = [6, 20, 34, 48, 62, 76, 90, 104, 118, 132, 146, 160, 174, 188, 202].map((x) => x);
  const local = frames.filter((h) => f >= h - 30 && f < h + 40);
  const hits: Hit[] = local.map((h) => ({ p: TARGETS[frames.indexOf(h) % TARGETS.length].p, k: (f - h) / 14 })).filter((h) => h.k >= 0 && h.k <= 1);
  const one = F >= C4_10 + COUNT10_FRAMES - 4;
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.6} />
      <CoralField x={0} />
      <group position={fp}>
        <Fish t={t} swim={0.1} open={0.28} look={[0.1, -0.2]} rim={1} />
        <Cocoon t={t} cover={1} hits={hits} />
        {one && (
          <mesh position={MARKS[1].clone().add(V(0, 0, 0.004))} scale={[0.06, 0.045, 0.014]} material={markMat()}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        )}
      </group>
      <Swarm eyes="dark"
        count={frames.length}
        seed={12}
        pose={(i, r) => {
          const tg = TARGETS[i % TARGETS.length];
          const k = f - frames[i];
          const d = bumpDist(k < -30 ? -30 : k > 40 ? 40 : k);
          if (k < -30 || k > 40) return null;
          const dirOut = tg.n.clone().add(V(0.2 * (r[0] - 0.5), 0.25, 0.3)).normalize();
          const p = fp.clone().add(tg.p.clone().addScaledVector(dirOut, d * 1.3));
          return { p, dir: fp.clone().add(tg.p).sub(p).multiplyScalar(k > 0 && k < 10 ? -1 : 1), s: 0.2 };
        }}
      />
    </>
  );
};
export const SplitCanvas: React.FC<{ side: "L" | "R" }> = ({ side }) => {
  const frame = useCurrentFrame();
  const ok = useAssets();
  if (!ok || frame < S[3] || frame >= C4_BACK) return null;
  return (
    <ThreeCanvas width={540} height={1920} camera={{ fov: 40, near: 0.05, far: 600 }} gl={{ antialias: true }} style={{ backgroundColor: "#0a1f4c" }}>
      <SplitHalf side={side} f={frame - S[3]} />
    </ThreeCanvas>
  );
};

const Scene4: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const BK = C4_BACK - S[3];
  if (f < BK) return null; // the split screen has its own canvases
  const k = f - BK;
  const cam = orbit(BED, -0.2 + k * 0.004, 7.0 - k * 0.006, 1.0, V(0, -0.25, 0), 38);
  cam.pos.add(drift(f, 0.025));
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={1} rays={0.7} />
      <CoralField x={BED_X} skip={bedSkip} />
      <BedSet />
      <Sleeper t={t} cover={1} />
      <SleepZ f={f} />
      <pointLight position={BED.clone().add(V(0.6, 1.4, 1.8))} intensity={1.0} color="#cfe0ff" distance={5} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 5: you were right. Dawn: the fish pushes out of the bag, the bag is left empty
// ---------------------------------------------------------------------------
const Scene5: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const OUT = C5_OUT - S[4];
  const night = ip(f, OUT, OUT + 40, 1, 0.55);
  const push = ip(f, OUT + 4, OUT + 34, 0, 1, Easing.inOut(Easing.quad));
  const tear = ip(f, OUT + 6, OUT + 16, 0, 1, out);
  const cam = f < OUT ? orbit(BED, 0.15 + f * 0.002, 6.8 - f * 0.006, 0.8, V(0, -0.25, 0), 38) : orbit(BED.clone().add(V(0.8, 0, 0)), 0.35, 7.0 - (f - OUT) * 0.01, 0.8, V(0.3, -0.25, 0), 38);
  cam.pos.add(drift(f, 0.025));
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={night} rays={ip(f, OUT, OUT + 40, 0.7, 1)} />
      <CoralField x={BED_X} skip={bedSkip} />
      <BedSet />
      <group position={BED} rotation={LEAN}>
        <Fish t={t} swim={0.1 + 0.8 * push} position={V(1.6 * push, 0.15 * push, 0.05 * push)} rotation={[0, 0, 0.12 * Math.sin(Math.PI * push)]} open={0.3} look={[0.3, 0]} rim={night} />
        <Cocoon t={t} cover={1} tear={tear} deflate={ip(f, OUT + 14, OUT + 50, 0, 0.6)} night={night} />
      </group>
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 6: sunrise, the fish leaves the empty bag... and it is hungry
// ---------------------------------------------------------------------------
const Scene6: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const LV = C6_LEAVE - S[5];
  const CL = C6_CLOSE - S[5];
  const GR = C6_GROWL - S[5];
  const night = ip(f, 0, LV + 20, 0.5, 0, Easing.out(Easing.quad));
  const bag = (
    <group position={BED} rotation={LEAN}>
      <Cocoon t={t} cover={1} tear={1} deflate={1} night={night} />
    </group>
  );
  if (f < LV) {
    // looking up at the surface: sunbeams come in
    const cam: Cam = { pos: BED.clone().add(V(4.2 + f * 0.01, 0.9, 4.6)), target: BED.clone().add(V(3.4, 7 + f * 0.02, -5)), fov: 44, roll: 0.05 };
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} night={night} rays={1.4} />
        <CoralField x={BED_X} skip={bedSkip} />
        <BedSet />
        {bag}
        <Fish t={t} swim={0.6} position={BED.clone().add(V(2.0, 0.4, 0.1))} look={[0.2, 0.3]} />
      </>
    );
  }
  if (f < CL) {
    // it swims off; the empty bag lies slumped on the sand in front
    const k = f - LV;
    const fp = BED.clone().add(V(2.2 + k * 0.05, 0.5 + k * 0.012, -0.3 - k * 0.01));
    const cam: Cam = { pos: BED.clone().add(V(-1.6 + k * 0.01, 0.7, 2.7)), target: BED.clone().add(V(0.9, 0.2, 0)), fov: 40 };
    cam.pos.add(drift(f, 0.03));
    return (
      <>
        <Rig {...cam} />
        <ReefEnv t={t} cam={cam.pos} night={night} rays={1.2} />
        <CoralField x={BED_X} skip={bedSkip} />
        <BedSet />
        {bag}
        <Fish t={t} swim={1} position={fp} look={[0.2, 0]} />
      </>
    );
  }
  // close-up, side: hungry, looking around
  const k = f - CL;
  const fp = BED.clone().add(V(5, 1.1 + 0.03 * Math.sin(k * 0.1), -0.6));
  const look: [number, number] = f < GR ? [0.3, 0] : [0.7 * Math.sin((f - GR) * 0.35), 0.15 * Math.cos((f - GR) * 0.27)];
  const wobble = f >= GR && f < GR + 18 ? 0.05 * Math.sin((f - GR) * 1.6) * (1 - (f - GR) / 18) : 0;
  const cam = orbit(fp, 0.2, 4.6 - k * 0.006, 0.15, V(0.3, 0.2, 0), 36);
  cam.pos.add(drift(f, 0.015));
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} night={night} rays={1.1} />
      <CoralField x={fp.x} />
      <Fish t={t} swim={0.4} position={fp} rotation={[wobble, 0, wobble * 0.6]} look={look} worry={0.4} open={0.35 + 0.15 * Math.max(0, Math.sin(k * 0.4))} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scenes 7-9 (background behind the cards): by day, the hungry fish in profile
// ---------------------------------------------------------------------------
const P7 = V(46, 2.7, 0);
const Scene789: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const fp = P7.clone().add(V(0.004 * f, 0.05 * Math.sin(f * 0.09), 0));
  const cam = orbit(fp, 0.28 - f * 0.0012, ip(f, 0, 46, 6.4, 5.2, out) - f * 0.002, 0.25, V(0.05, -0.45, 0), 36);
  cam.pos.add(drift(f, 0.03));
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} />
      <CoralField x={fp.x} />
      {/* scene 9: only the reef behind (the friend and the small cards are on top) */}
      {f < S[8] - S[6] && <Fish t={t} swim={0.45} position={fp} look={[0.5 * Math.sin(f * 0.21), 0.3 * Math.cos(f * 0.17)]} worry={0.4} open={0.3} />}
    </>
  );
};

export const Papagaio2Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ok = useAssets();
  const sc = sceneOf(frame);
  const f = frame - S[sc];
  if (!ok) return null;
  if (sc === 3 && frame < C4_BACK) return null;
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
      {sc >= 6 && <Scene789 f={frame - S[6]} />}
    </ThreeCanvas>
  );
};

// ---------------------------------------------------------------------------
// The two choice cards (their own small canvases). They show the places only, never the answer.
// ---------------------------------------------------------------------------
// A: the outer reef, seen from just above the water: waves rolling in and breaking over the shallow
// reef, white foam on the crests and spreading behind them, the dark reef showing through the water
const surfMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime; varying vec3 vW; varying float vCrest; varying float vH;
      float wave(float z, float ph){ float s = fract(z * 0.11 - uTime * 0.32 + ph); return pow(s, 4.0) * (1.0 - smoothstep(0.88, 0.97, s)); }
      void main(){
        vec3 p = position;
        // rolling swells coming towards the camera (+z): steep front, long back
        float c = wave(p.z + 0.6 * sin(p.x * 0.25), 0.0);
        float h = c * 2.2 + 0.08 * sin(p.x * 0.7 + uTime * 1.3) + 0.06 * sin(p.z * 0.9 - uTime * 1.9);
        p.y += h;
        vCrest = c; vH = h;
        vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vW; varying float vCrest; varying float vH;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ return 0.5*noise(p) + 0.25*noise(p*2.1+3.0) + 0.125*noise(p*4.3+7.0) + 0.0625*noise(p*8.7); }
      void main(){
        vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
        if (N.y < 0.0) N = -N;
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        // shallow turquoise over the reef: dark coral patches show through
        float reef = smoothstep(0.45, 0.7, fbm(vW.xz * 0.35));
        vec3 water = mix(vec3(0.04, 0.56, 0.62), vec3(0.02, 0.22, 0.26), reef * 0.9);
        water = mix(water, vec3(0.45, 0.75, 0.9), fres * 0.45);
        float sun = pow(max(dot(reflect(-normalize(vec3(-0.3, 0.6, -1.0)), N), V), 0.0), 60.0);
        // white water: on the breaking crest, churning behind it, streaks of foam on the face
        float churn = fbm(vW.xz * vec2(1.2, 2.2) + vec2(0.0, -uTime * 0.6));
        float crest = smoothstep(0.3, 0.7, vCrest + 0.3 * (churn - 0.5));
        float back = fract((vW.z + 20.0) * 0.11 - uTime * 0.32); float trail = smoothstep(0.42, 0.7, churn) * smoothstep(0.0, 0.25, back) * (1.0 - smoothstep(0.3, 0.6, back)) * 1.3;
        float lace = smoothstep(0.62, 0.85, fbm(vW.xz * 2.5 + uTime * 0.2)) * 0.6;
        float foam = clamp(crest * 1.2 + trail * 0.8 + lace, 0.0, 1.0);
        vec3 col = mix(water, vec3(0.97, 0.99, 1.0), foam) + sun * 0.8;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
const CardA: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const mat = useMemo(surfMat, []);
  mat.uniforms.uTime.value = t;
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(90, 90, 260, 260);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const k = f - C7_A;
  const bob = 0.12 * Math.sin(t * 1.6);
  const cam: Cam = { pos: V(0.6 - k * 0.006, 3.2 + bob, 10 - k * 0.01), target: V(-0.3, 0.6 + bob * 0.5, -8), fov: 46, roll: 0.03 * Math.sin(t * 1.1) };
  // spray thrown up by the breaking crests
  const spray = useMemo(() => {
    const N = 320;
    const r = rng(52);
    const rnd = Array.from({ length: N }, () => [r(), r(), r(), r()]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(N), 1));
    return { N, rnd, g, m: alphaPoints({ map: softSprite(), size: 0.32, color: "#ffffff", fog: false }) };
  }, []);
  const pa = spray.g.attributes.position as THREE.BufferAttribute;
  const aa = spray.g.attributes.aAlpha as THREE.BufferAttribute;
  for (let i = 0; i < spray.N; i++) {
    const [a, b, c, d] = spray.rnd[i];
    // the crest line nearest to each particle, moving towards the camera like the swells (period 1/0.11 units)
    const zc = (((0.86 + t * 0.32) / 0.11) % (1 / 0.11)) + (Math.floor(c * 4) - 2) * (1 / 0.11) - 20;
    const life = (t * (1.2 + a) + b) % 1;
    pa.setXYZ(i, (a - 0.5) * 26, 1.9 + life * (1.2 + d) - life * life * 1.6, zc - life * 1.2);
    aa.setX(i, (1 - life) * 0.8);
  }
  pa.needsUpdate = aa.needsUpdate = true;
  return (
    <>
      <Rig {...cam} />
      <mesh material={skyMat()}>
        <sphereGeometry args={[240, 24, 16]} />
      </mesh>
      <hemisphereLight args={["#ffffff", "#5fc8d0", 1.4]} />
      <mesh geometry={geo} material={mat} position={[0, 0, -20]} />
      <points geometry={spray.g} material={spray.m} frustumCulled={false} renderOrder={10} />
    </>
  );
};
// B: the calm lagoon, shallow and smooth, white sand, the island's beach behind
const skyMat = () =>
  memo(
    "skyDome",
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; void main(){ float y = normalize(vP).y; vec3 c = mix(vec3(0.85, 0.96, 1.0), vec3(0.25, 0.6, 0.95), smoothstep(0.0, 0.45, y));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
  );
const CardB: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const k = f - C7_B;
  const cam: Cam = { pos: V(-4 + k * 0.012, 1.25 + 0.03 * Math.sin(t * 0.8), 14.5 - k * 0.01), target: V(-1.5, 1.2, 0), fov: 40 };
  return (
    <>
      <Rig {...cam} />
      <mesh material={skyMat()}>
        <sphereGeometry args={[240, 24, 16]} />
      </mesh>
      <AerialSet t={t * 0.4} grow={0.3} sand={0} sway={2.6} palmT={t} />
    </>
  );
};

export const CardCanvas: React.FC<{ which: "A" | "B"; width: number; height: number }> = ({ which, width, height }) => {
  const frame = useCurrentFrame();
  const ok = useAssets();
  if (!ok) return null;
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 40, near: 0.05, far: 600 }} gl={{ antialias: true }} style={{ backgroundColor: which === "A" ? "#0b84ad" : "#7fc6f0" }}>
      {which === "A" ? <CardA f={frame} /> : <CardB f={frame} />}
    </ThreeCanvas>
  );
};

// ---------------------------------------------------------------------------
// Scene 9: the friend. A smaller parrotfish (same model) swims confused from card A to card B and back,
// never picking one. Its own transparent canvas, on top of the small cards. It turns with the snout
// swinging AWAY from the camera, so it is never seen from the front.
// ---------------------------------------------------------------------------
const PX = 7.2794 / 1920; // world units per pixel at the friend's depth (camera at z 10, fov 40)
const toW = (px: number, py: number) => V((px - 540) * PX, (960 - py) * PX, 0);
const signTexture = () =>
  memo("seuAmigoSign", () => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 150;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0b1c22";
    g.beginPath();
    g.roundRect(4, 4, 504, 142, 26);
    g.fill();
    g.fillStyle = "#FFD23F";
    g.beginPath();
    g.roundRect(16, 16, 480, 118, 18);
    g.fill();
    g.fillStyle = "#000";
    g.font = "900 78px Montserrat, Arial Black, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("SEU AMIGO", 256, 80);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  });
const FRIEND_Y = 965; // below the small cards: the sign never covers their labels
const friendPose = (k: number, turns: number[]) => {
  const [t1, t2] = turns;
  const e = Easing.inOut(Easing.quad);
  let x: number;
  let yaw: number;
  if (k < t1) {
    x = ip(k, -6, t1, 230, 610, e);
    yaw = 0;
  } else if (k < t1 + 8) {
    x = 610 + 12 * Math.sin(((k - t1) / 8) * Math.PI);
    yaw = ip(k, t1, t1 + 8, 0, Math.PI, e); // snout swings away from the camera
  } else if (k < t2) {
    x = ip(k, t1 + 8, t2, 610, 300, e);
    yaw = Math.PI;
  } else if (k < t2 + 8) {
    x = 300 - 12 * Math.sin(((k - t2) / 8) * Math.PI);
    yaw = ip(k, t2, t2 + 8, Math.PI, 0, e); // back through "away" again, never through "towards"
  } else {
    x = ip(k, t2 + 8, t2 + 30, 300, 460, Easing.out(Easing.quad));
    yaw = 0;
  }
  return { p: toW(x, FRIEND_Y + 14 * Math.sin(k * 0.25)), yaw };
};
export const FriendCanvas: React.FC<{ turns: number[] }> = ({ turns }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ok = useAssets();
  const k = frame - S[8];
  if (!ok || k < 0 || frame >= DURATION) return null;
  const { p, yaw } = friendPose(k, turns.map((t) => t - S[8]));
  const enter = ip(k, 0, 8, 0, 1, out);
  const confused: [number, number] = [0.6 * Math.sin(k * 0.45), 0.25 * Math.cos(k * 0.3)];
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 40, near: 0.05, far: 100, position: [0, 0, 10] }} gl={{ antialias: true, alpha: true }} style={{ position: "absolute", inset: 0 }}>
      <Rig pos={V(0, 0, 10)} target={V(0, 0, 0)} />
      <ambientLight intensity={1.0} color="#d8f4ff" />
      <hemisphereLight args={["#e6fdff", "#2c95a8", 1.2]} />
      <directionalLight position={[3, 8, 6]} intensity={2.0} color="#fff3d4" />
      <group position={p} scale={0.5 * enter}>
        <Fish t={frame / FPS} swim={1.2} rotation={[0, yaw, 0]} look={confused} worry={0.6} open={0.3 + 0.1 * Math.sin(k * 0.5)} />
      </group>
      <sprite position={p.clone().add(V(0, 0.3 + 0.02 * Math.sin(k * 0.3), 0.3))} scale={[0.95 * enter, 0.28 * enter, 1]} renderOrder={30}>
        <spriteMaterial map={signTexture()} transparent depthTest={false} />
      </sprite>
    </ThreeCanvas>
  );
};
export { DURATION };
