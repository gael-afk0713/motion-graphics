// "Peixe-papagaio – parte 3/3": all the 3D shots. Same world, fish, reef, corals, sand and island as parts
// 1 and 2 (imported from ../papagaio, unchanged); the colour of the fish goes through ColorFish
// (./FishColors: new `colorMode` property, the model is untouched). The camera is never in front of a
// parrotfish: side or 3/4 only (orbit() is clamped; groups only turn with the snout away from the camera).
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { BEAK_TIP, VENT } from "../papagaio/Fish";
import { alphaPoints, causticMaterial, clamp, fbm3, memo, rng, softSprite, V } from "../papagaio/gfx";
import { useAssets } from "../papagaio/Globe";
import { islandGeo, palmGeo, waterMat } from "../papagaio/Island";
import { Bubbles, Coral, Mound, ReefEnv, SandCloud } from "../papagaio/Reef";
import { ColorFish, FEMALES } from "./FishColors";
import { FishLights, IslandSet, Rock3, Scenery, Seabed, Underwater } from "./World";
import {
  BITES,
  C1_CHEFE,
  C1_GONE,
  C2_BAD,
  C3_BITE,
  C3_HOURS,
  C3_NADA,
  C3_WORST,
  C4_INSIST,
  C4_PUSH,
  C5_ARRIVE,
  C5_GROUP,
  C6_ARROW,
  C6_COLORS,
  C6_LEAD,
  C7_LAPSE,
  C7_SAND,
  C7_TONS,
  C8_BUILD,
  C8_ILHA,
  C8_FEMEA,
  C8_MACHO,
  COLOR_FRAMES,
  FPS,
  S,
  SCENE_DURATIONS,
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
/** a slow aimless wander for the fish of a group: small drift, the snout swinging a little (never towards the camera) */
const wander = (k: number, i: number, amp = 0.35) => ({
  d: V(amp * Math.sin(k * 0.031 + i * 1.7), 0.18 * Math.sin(k * 0.047 + i * 2.3), 0.25 * Math.sin(k * 0.027 + i)),
  // yaw > 0 turns the snout AWAY from the camera (+z): only small positive swings, or facing the other way
  yaw: (i % 2 ? Math.PI : 0) + (i % 2 ? -1 : 1) * (0.22 + 0.2 * Math.sin(k * 0.05 + i * 1.3)),
});

// ---------------------------------------------------------------------------
// Small reef fish (a school in the back): simple shapes, not parrotfish
// ---------------------------------------------------------------------------
const schoolGeo = () =>
  memo("p3school", () => {
    const body = new THREE.SphereGeometry(1, 12, 8);
    body.scale(0.2, 0.075, 0.04);
    const tail = new THREE.ConeGeometry(0.06, 0.1, 4);
    tail.rotateZ(Math.PI / 2);
    tail.scale(1, 1, 0.35);
    return { body, tail };
  });
const schoolMats = () =>
  memo("p3schoolMats", () => [
    new THREE.MeshStandardMaterial({ color: "#f08a4b", roughness: 0.4, emissive: "#4a1d06", emissiveIntensity: 0.3 }),
    new THREE.MeshStandardMaterial({ color: "#a9d9d2", roughness: 0.3, metalness: 0.3, emissive: "#0c3a3a", emissiveIntensity: 0.3 }),
  ]);
const School: React.FC<{ f: number; center: THREE.Vector3; n?: number }> = ({ f, center, n = 34 }) => {
  const g = schoolGeo();
  const m = schoolMats();
  const rnd = useMemo(() => {
    const r = rng(41);
    return Array.from({ length: n }, () => [r(), r(), r(), r()]);
  }, [n]);
  return (
    <group>
      {rnd.map(([a, b, c, d], i) => {
        const ang = f * 0.012 + a * 0.9;
        const p = center.clone().add(V(Math.cos(ang) * 4 + (b - 0.5) * 1.6, (c - 0.5) * 1.2 + 0.15 * Math.sin(f * 0.1 + d * 9), Math.sin(ang) * 1.2 - 1 + (d - 0.5) * 1.2));
        const yaw = -ang - Math.PI / 2;
        const wig = 0.3 * Math.sin(f * 0.6 + a * 20);
        const mat = m[i % 2];
        return (
          <group key={i} position={p} rotation={[0, yaw, 0]}>
            <mesh geometry={g.body} material={mat} />
            <mesh geometry={g.tail} material={mat} position={[-0.23, 0, 0]} rotation={[0, wig, 0]} />
          </group>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Scene 1: the hook. Reef by day; the group swims in with the big colourful male; he dissolves
// ---------------------------------------------------------------------------
const fish1 = (f: number) => V(-3 + 0.045 * f, 2.6 + 0.06 * Math.sin(f * 0.11), 0);
const GROUP1 = (f: number) => V(-0.6 + 0.022 * f, 3.2 + 0.05 * Math.sin(f * 0.07), -5.2);
const Scene1: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const CH = C1_CHEFE - S[0];
  const GO = C1_GONE - S[0];
  const fp = fish1(f);
  let cam: Cam;
  if (f < CH) {
    // already moving at frame 0: 3/4 swinging to the side, the camera slowly closing in
    // the WHOLE fish in the frame (>= 60 px on each side), already moving at frame 0
    cam = orbit(fp, ip(f, 0, CH, 0.42, 0.3), ip(f, 0, CH, 8.4, 7.6, Easing.out(Easing.quad)), 0.35, V(-0.2, -0.05, 0), 38);
  } else {
    // a little wider: the group swims in behind
    const k = f - CH;
    const g = GROUP1(f);
    const mid = fp.clone().lerp(g, 0.45);
    const d = ip(k, 0, 14, 7.6, 9.4, out);
    cam = { pos: fp.clone().add(V(ip(k, 0, 14, 1.2, 1.6), ip(k, 0, 14, 0.25, 0.5), d)), target: mid.add(V(0.2, -0.1, 0)), fov: 38 };
  }
  cam.pos.add(drift(f));
  const enter = ip(f, CH - 2, CH + 14, 0, 1, out);
  const g = GROUP1(f);
  const vanish = ip(f, GO, GO + 20, 0, 1, Easing.in(Easing.quad));
  const females = [V(-1.9, 0.4, 0.4), V(1.8, -0.35, 0.3), V(-1.1, -0.65, -0.6), V(1.2, 0.55, -0.7)];
  return (
    <>
      <Rig {...cam} />
      <Underwater t={t} cam={cam.pos} />
      <Scenery x={fp.x} t={t} />
      <FishLights fish={fp} cam={cam.pos} />
      <ColorFish t={t} position={fp} open={0.2 + 0.06 * Math.sin(f * 0.2)} look={[0.3, 0]} />
      {f >= CH - 2 && (
        <group position={g.clone().add(V(-7 * (1 - enter), 0, 0))}>
          {females.map((p, i) => (
            <ColorFish key={i} t={t + i * 0.37} swim={1.1} position={p.clone().add(V(0.1 * Math.sin(f * 0.05 + i), 0.06 * Math.sin(f * 0.08 + i * 2), 0))} scale={0.7} palette={FEMALES[i]} paletteKey={`p3fem${i}`} look={[0.2, 0]} />
          ))}
          {vanish < 1 && <ColorFish t={t} swim={0.9} position={V(0, 0.05, 0)} scale={1.3} colorMode={1} vanish={vanish} look={[0.2, 0]} />}
          {vanish > 0 && vanish < 1 && <pointLight position={[0, 0.2, 1]} intensity={4 * Math.sin(Math.PI * vanish)} color="#fff6d0" distance={6} />}
        </group>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 2: the lagoon the audience voted for: clear turquoise, smooth and shiny, white sand, the beach behind
// ---------------------------------------------------------------------------
const ISL2 = V(-1.4, -1.6, -5.4);
const Scene2: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  // the calm lagoon from the water level: clear shallow water over the sand, the little island with its palms
  const cam: Cam = { pos: V(-3.6 + f * 0.01, 1.1 + 0.03 * Math.sin(t * 0.8), 9.6 - f * 0.012), target: V(-1.4, 0.7, -5.4), fov: 40 };
  return (
    <>
      <Rig {...cam} />
      <IslandSet t={t} isle={ISL2} size={1.25} palms={[{ seed: 1, at: [0.3, -0.3], s: 0.62 }, { seed: 2, at: [-1.0, 0.5], s: 0.5 }]} cool={ip(f, C2_BAD - S[1], C2_BAD - S[1] + 10, 0, 1)} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 3: hunger in the lagoon. Dead rock and white-grey dead coral, almost no algae
const DX = 120; // a stretch of the world with no live corals
// ---------------------------------------------------------------------------
// --- scene 3, "Seu bico morde pedra morta": a block of DEAD CORAL (grey-white, rough, the porous texture
// of a coral skeleton: little round cups / corallites), 3 real side bites, chips falling, a short puff of
// dust, light scratches left on the block. Nothing edible comes off.
const deadCoralTexture = () =>
  memo("p3deadCoralTex", () => {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const r = rng(83);
    g.fillStyle = "#d6d1c7";
    g.fillRect(0, 0, S, S);
    // mottled, chalky
    for (let i = 0; i < 1400; i++) {
      const v = 190 + Math.floor(r() * 50);
      g.fillStyle = `rgba(${v},${v - 4},${v - 12},0.35)`;
      g.beginPath();
      g.arc(r() * S, r() * S, 2 + r() * 9, 0, Math.PI * 2);
      g.fill();
    }
    // corallites: small cups with a dark pit and a lighter rim, packed like a skeleton
    for (let i = 0; i < 900; i++) {
      const x = r() * S;
      const y = r() * S;
      const rad = 3 + r() * 5;
      g.fillStyle = "rgba(235,232,224,0.9)";
      g.beginPath();
      g.arc(x, y, rad + 1.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(120,114,104,0.85)";
      g.beginPath();
      g.arc(x, y, rad * 0.62, 0, Math.PI * 2);
      g.fill();
    }
    // fine grit
    const img = g.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 26;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.4, 1.4);
    t.anisotropy = 8;
    return t;
  });
const deadCoralBump = () =>
  memo("p3deadCoralBump", () => {
    const t = deadCoralTexture().clone();
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  });
/** a rough block: a subdivided box, every vertex pushed in/out by noise of its position (so the faces stay
 *  joined), hard edges kept; not a rounded potato */
const deadBlockGeo = () =>
  memo("p3deadBlock", () => {
    const g = new THREE.BoxGeometry(1, 1, 1, 18, 14, 18);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      // big lumps (no flat box faces), smaller knobs, fine grit; the top a little more uneven
      const lump = fbm3(v.x * 1.7 + 5, v.y * 1.7, v.z * 1.7, 3) - 0.5;
      const n = fbm3(v.x * 3.4 + 2, v.y * 3.4, v.z * 3.4, 4) - 0.5;
      const fine = fbm3(v.x * 12 + 1, v.y * 12, v.z * 12, 2) - 0.5;
      const top = v.y > 0.3 ? 1.4 : 1;
      const d = v.clone().normalize().multiplyScalar((0.34 * lump + 0.14 * n) * top + 0.04 * fine);
      p.setXYZ(i, v.x + d.x, v.y + d.y, v.z + d.z);
    }
    g.computeVertexNormals();
    return g;
  });
const deadBlockMat = () =>
  memo("p3deadBlockMat", () => causticMaterial({ map: deadCoralTexture(), bumpMap: deadCoralBump(), bumpScale: 3.5, color: "#efebe3", roughness: 0.96 }, 0.6));
const BLOCK_SIZE = V(1.0, 0.74, 0.95);
const chipGeo = () => memo("p3chip", () => new THREE.TetrahedronGeometry(1, 0));
const chipMat = () => memo("p3chipMat", () => new THREE.MeshStandardMaterial({ color: "#bdb7ac", roughness: 0.9, flatShading: true }));
const scratchMat = () => memo("p3scratchMat", () => new THREE.MeshBasicMaterial({ color: "#fbfaf6", transparent: true, opacity: 0.85, depthWrite: false }));
/** what one bite leaves: chips that fall with gravity (and stay on the floor), a short puff of dust
 *  (rises a little, drifts, gone in ~15 frames), 3 light scratches on the block's front face */
const BiteDebris: React.FC<{ k: number; at: THREE.Vector3; seed: number; floorY: number; front: number }> = ({ k, at, seed, floorY, front }) => {
  const rnd = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: 14 }, () => [r(), r(), r(), r(), r()]);
  }, [seed]);
  if (k < 0) return null;
  const chips = rnd.slice(0, 8).map(([a, b, c, d, e], i) => {
    // launched out of the bite (towards the fish and the camera), then falling
    const vx = -0.012 - 0.022 * a;
    const vy = 0.012 + 0.03 * b;
    const vz = 0.006 + 0.022 * c;
    const g = 0.0042;
    const tLand = (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, at.y - floorY))) / g;
    const tt = Math.min(k, tLand);
    const pos = V(at.x + vx * tt, Math.max(floorY, at.y + vy * tt - 0.5 * g * tt * tt), at.z + 0.02 + vz * tt);
    const s = 0.022 + 0.03 * d;
    return (
      <mesh key={i} geometry={chipGeo()} material={chipMat()} position={pos} rotation={[tt * 0.4 * (e + 0.5), tt * 0.3 * a, tt * 0.5 * b]} scale={[s, s * 0.7, s]} />
    );
  });
  const life = k / 15;
  const dust =
    life < 1
      ? rnd.map(([a, b, c, d], i) => {
          const pos = V(at.x - 0.05 - 0.12 * life * (0.5 + a), at.y + 0.02 + 0.1 * life * (0.4 + b), at.z + 0.05 + 0.1 * life * c);
          const s = 0.07 + 0.2 * life * (0.6 + d);
          const o = 0.75 * Math.sin(Math.PI * Math.min(1, life * 1.1)) * (0.6 + 0.4 * a);
          return (
            <sprite key={`d${i}`} position={pos} scale={[s, s, s]} renderOrder={12}>
              <spriteMaterial map={softSprite()} color="#ddd8ce" transparent opacity={o} depthWrite={false} />
            </sprite>
          );
        })
      : null;
  // light scratches on the front face, next to the bitten corner (they stay)
  const sc = Math.min(1, k / 3);
  const scratches = [0, 1, 2].map((j) => (
    <mesh key={`s${j}`} position={[at.x + 0.05 + 0.035 * j + 0.03 * rnd[j][0], at.y - 0.035 - 0.035 * j, front + 0.006]} rotation={[0, 0, -0.35 + 0.2 * rnd[j][1]]} scale={[0.1 * sc, 0.007, 1]} material={scratchMat()} renderOrder={11}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  ));
  return (
    <group>
      {chips}
      {dust}
      {scratches}
    </group>
  );
};
const BITE_X = DX + 3.5; // the bitten corner of the block (world x)
const BITE_Y = 0.66;
const BLOCK_Z = -0.55; // its front face stays behind the beak (seen in 3/4 it never covers it)
/** the block's real front surface (z, block space) near the bitten corner, for the scratches */
const blockFrontNearCorner = () =>
  memo("p3blockFront", () => {
    const p = deadBlockGeo().attributes.position;
    let z = 0.5;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0.3 && p.getX(i) < -0.2 && p.getY(i) > 0.15) z = Math.max(z, p.getZ(i));
    return z;
  });
const Scene3: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const BI = C3_BITE - S[2];
  const NA = C3_NADA - S[2];
  const HO = C3_HOURS - S[2];
  const WO = C3_WORST - S[2];
  const bites = BITES.map((b) => b - S[2]);
  if (f >= BI && f < HO) {
    // side view, the body almost horizontal (base tilt 2.3 deg, at most ~7 deg with a nod). 3 short, quick bites
    // on the corner of the dead-coral block, on "morde / pedra / morta": the beak plates open wide, close on the
    // surface, the head nods 5 deg; each bite ~6 frames. The tilt pivots on the beak tip, so it never sinks into
    // the block. "Nada": it backs off a little and stops; the block is intact. Slow push-in all along.
    const still = f >= NA;
    let open = 0.3;
    let lunge = 0;
    let nod = 0;
    for (const b of bites) {
      const p = f - b;
      if (p >= -4 && p < 0) {
        open = ip(p, -4, -1, 0.3, 1.0, out);
        lunge = ip(p, -4, 0, 0, 0.07, Easing.in(Easing.quad));
      } else if (p >= 0 && p <= 2) {
        open = 0;
        lunge = 0.07;
        nod = 0.088 * Math.sin((Math.PI * (p + 1)) / 4);
      } else if (p > 2 && p <= 6) {
        open = ip(p, 2, 6, 0, 0.3);
        lunge = ip(p, 2, 6, 0.07, 0, out);
      }
    }
    const approach = ip(f, BI, bites[0] - 5, -0.42, -0.07, out);
    const back = ip(f, NA, NA + 12, 0, 0.32, Easing.inOut(Easing.quad));
    const theta = -0.04 - nod;
    // where the beak tip is this frame, and the fish placed around it (rotation pivots on the tip)
    const tip = V(BITE_X + approach + lunge - back, BITE_Y + 0.01, 0);
    const fp = tip.clone().sub(BEAK_TIP.clone().applyAxisAngle(V(0, 0, 1), theta));
    const k = ip(f, BI, HO, 0, 1, Easing.linear);
    // the whole fish, tail included, head clear of the right 160 px; slow push-in
    const cam = orbit(V(BITE_X - 0.75, BITE_Y, 0), 0.3, 7.0 - 0.5 * k, 0.55, V(0, 0.42, 0), 40); // bite and block left of the right 160 px
    if (!still) cam.pos.add(drift(f, 0.012));
    const blockPos = V(BITE_X - 0.03 + BLOCK_SIZE.x / 2, BITE_Y + 0.03 - BLOCK_SIZE.y / 2, BLOCK_Z);
    const front = BLOCK_Z + blockFrontNearCorner() * BLOCK_SIZE.z;
    return (
      <>
        <Rig {...cam} />
        <Underwater t={t} cam={cam.pos} dead dim={0.05} shafts={0.8} hero={1} />
        <Scenery x={BITE_X} t={t} dead clear={(x, z) => Math.abs(x - BITE_X) < 1.4 && z > -1.9} seed={3} />
        <School f={f} center={V(BITE_X - 1, 4.2, -6)} n={22} />
        <FishLights fish={fp} cam={cam.pos} />
        <mesh geometry={deadBlockGeo()} material={deadBlockMat()} position={blockPos} scale={BLOCK_SIZE} />
        <ColorFish t={t} swim={still ? 0.15 + 0.2 * (1 - back) : 0.45} position={fp} rotation={[0, 0, theta]} open={open} look={[0.35, -0.15]} worry={0.5} />
        {bites.map((b, i) => (
          <BiteDebris key={i} k={f - b} at={V(BITE_X + 0.03, BITE_Y + 0.01, 0.06)} seed={30 + i} floorY={0.06} front={front} />
        ))}
      </>
    );
  }
  // tracking side shot over the dead floor; after "há horas" slower, weaker; "Mas o pior": the camera pushes in
  const slow = ip(f, HO, HO + 60, 1, 0.35);
  const x = f < BI ? DX - 4 + 0.032 * f : DX + 6 + 0.02 * (f - HO) * slow;
  const fp = V(x, 1.5 + 0.05 * Math.sin(f * 0.07), 0);
  const push = ip(f, WO, WO + 8, 0, 1, out);
  // "Mas o pior": a short push-in (with the 1.06 zoom of the camera layer, ~1.25x in all), head and eye inside
  // the fish a little lower in the frame and a little bigger (less empty floor), whole, head clear of the right edge
  const cam = f < BI ? orbit(fp, 0.28, 7.2, 0.7, V(0.05, 0.25, 0), 38) : orbit(fp, 0.12, 7.6 - 0.9 * push, 0.7 - 0.25 * push, V(0.15 * push, 0.25 - 0.1 * push, 0), 38); // tail stays in
  cam.pos.add(drift(f, 0.03));
  return (
    <>
      <Rig {...cam} />
      <Underwater t={t} cam={cam.pos} dead dim={0.05} shafts={0.8} hero={1} />
      <Scenery x={fp.x} t={t} dead seed={3} />
      <School f={f} center={fp.clone().add(V(0.5, 2.9, -7))} n={22} />
      <FishLights fish={fp} cam={cam.pos} />
      <ColorFish t={f < BI ? t : HO / FPS + (f - HO) / FPS * slow} swim={f < BI ? 0.8 : 0.9 * slow} position={fp} open={0.28} look={[0.3, -0.25]} worry={f >= HO ? 0.6 : 0.3} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 4: the crossing, all UNDER WATER. Low side camera, no horizon / sky: the surface is only a light
// wavy band at the top of the frame, with white foam and breaking crests. The current comes from the
// outer reef (right): particles, bubbles and sand streak right -> left. The fish (side view, always under
// water) moves right for real, is dragged back left ~25% of the frame in ~0.6 s, then insists and
// crosses the foam line to the right (the whoosh cut to the outer reef comes right after).
// ---------------------------------------------------------------------------
const X4 = 200;
const PU4 = C4_PUSH - S[3]; // "empurra você de volta"
const IN4 = C4_INSIST - S[3]; // "Você insiste"
const END4 = SCENE_DURATIONS[3];
const DRAG4 = 18; // the drag back lasts 0.6 s
/** camera x (it follows, slower than the fish while it advances, a little back during the drag) */
const cam4X = (k: number) => {
  const a = X4 + 0.022 * Math.min(k, PU4);
  if (k < PU4) return a;
  const b = a - 0.15 * ip(k, PU4, PU4 + DRAG4, 0, 1, out);
  if (k < IN4) return b;
  return b + 0.045 * (k - IN4);
};
/** the fish relative to the camera (world units; the frame is ~3.7 units wide at the camera distance) */
const rel4 = (k: number) => {
  if (k < PU4) return -0.95 + 1.25 * ip(k, 0, PU4, 0, 1, Easing.inOut(Easing.sin)); // advancing for real (head stays clear of the right 160 px)
  const dragged = 0.3 - 0.95 * ip(k, PU4, PU4 + DRAG4, 0, 1, out); // dragged left ~25% of the width
  if (k < IN4) return dragged + 0.12 * ip(k, PU4 + DRAG4 + 4, IN4, 0, 1) + 0.04 * Math.sin(k * 0.7); // fighting, barely holding
  return dragged + 0.12 + 2.0 * ip(k, IN4, END4, 0, 1, Easing.inOut(Easing.quad)); // insists: across the foam line
};
const fish4X = (k: number) => cam4X(k) + rel4(k);
const EDGE = fish4X(IN4 + 20) + 0.25; // the foam line: the fish crosses it ~0.7 s after "Você insiste"
const FISH4_Y = 2.0;
const SURF_Y = FISH4_Y + 2.5; // 3 units above the camera
const surfMat4 = () =>
  memo(
    "p3surf4",
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uEdge: { value: EDGE } },
        vertexShader: /* glsl */ `
          uniform float uTime; uniform float uEdge; varying vec3 vW; varying float vCrest;
          void main(){
            vec3 p = position;
            vec4 w0 = modelMatrix * vec4(p, 1.0);
            // swells rolling in from the outer reef (towards -x), taller near the reef edge
            float big = smoothstep(uEdge - 8.0, uEdge + 1.0, w0.x);
            float s = fract(w0.x * 0.16 + uTime * 0.55 + 0.15 * sin(w0.z * 0.4));
            float crest = pow(s, 3.0) * (1.0 - smoothstep(0.85, 0.98, s));
            float h = (0.15 + 0.55 * big) * crest + 0.05 * sin(w0.x * 1.7 + w0.z * 0.9 + uTime * 2.3);
            vCrest = crest * (0.4 + 0.6 * big);
            w0.y -= h; // seen from below: the crests dip towards the camera
            vW = w0.xyz;
            gl_Position = projectionMatrix * viewMatrix * w0;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uEdge; varying vec3 vW; varying float vCrest;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
          float fbm(vec2 p){ return 0.5*noise(p) + 0.25*noise(p*2.1+3.0) + 0.125*noise(p*4.3+7.0) + 0.0625*noise(p*8.7); }
          void main(){
            float big = smoothstep(uEdge - 8.0, uEdge + 1.0, vW.x);
            // the underside of the surface: light, rippled
            float rip = fbm(vW.xz * 0.9 + vec2(uTime * 0.9, 0.0));
            vec3 col = mix(vec3(0.30, 0.66, 0.70), vec3(0.62, 0.90, 0.90), rip);
            // foam: on the crests and in streaks drifting left with the current
            vec2 q = vW.xz * vec2(0.7, 0.9) + vec2(uTime * 1.4, 0.0);
            float churn = fbm(q + fbm(q * 1.6 + uTime * 0.5) * 1.4);
            float streak = smoothstep(0.55, 0.8, fbm(vec2(vW.x * 0.35 + uTime * 1.1, vW.z * 2.2)));
            float foam = clamp(smoothstep(0.25, 0.7, vCrest + 0.4 * (churn - 0.5)) + streak * (0.35 + 0.5 * big) + smoothstep(0.62, 0.8, churn) * big, 0.0, 1.0);
            col = mix(col, vec3(0.97, 0.99, 1.0), foam);
            // only the stretch of surface right above the camera: it reads as a band at the top of the
            // frame, never down to a horizon (fades out towards the back)
            gl_FragColor = vec4(col, smoothstep(-1.5, 0.8, vW.z));
            #include <colorspace_fragment>
          }`,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
  );
/** deep water all round the camera (no sky, no horizon): darker and greener than the lagoon */
const deepMat4 = () =>
  memo(
    "p3deep4",
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; void main(){ float y = normalize(vP).y;
          vec3 c = y > 0.0 ? mix(vec3(0.06, 0.30, 0.38), vec3(0.11, 0.40, 0.48), smoothstep(-0.05, 0.9, y)) : vec3(0.06, 0.30, 0.38); // below eye level: the same colour as the fog, so the floor fades out with no line
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
        side: THREE.BackSide,
        fog: false,
      }),
  );
const FOG4 = "#4595a6"; // = the deep water colour at eye level: linear (0.06, 0.30, 0.38) written in sRGB
/** the current: speed in units / frame (right -> left), strong during the drag */
const speed4 = (k: number) => 0.07 + 0.3 * ip(k, PU4 - 2, PU4 + 3, 0, 1) * (1 - 0.55 * ip(k, PU4 + DRAG4, PU4 + DRAG4 + 12, 0, 1)) + 0.05 * ip(k, IN4, IN4 + 10, 0, 1);
const carried4 = (k: number) => {
  let s = 0;
  for (let i = 0; i < k; i++) s += speed4(i);
  return s;
};
/** particles and sand as short streaks (longer when the current is stronger), bubbles, all moving left */
const Current4: React.FC<{ k: number; cx: number }> = ({ k, cx }) => {
  const sys = useMemo(() => {
    const N = 420;
    const r = rng(23);
    const rnd = Array.from({ length: N }, () => [r(), r(), r(), r()]);
    const seg = new THREE.BufferGeometry();
    seg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    const B = 160;
    const bub = new THREE.BufferGeometry();
    bub.setAttribute("position", new THREE.BufferAttribute(new Float32Array(B * 3), 3));
    bub.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(B), 1));
    return {
      N,
      B,
      rnd,
      seg,
      bub,
      segM: new THREE.LineBasicMaterial({ color: "#f4f1e4", transparent: true, opacity: 0.55, depthWrite: false, fog: false }),
      bubM: alphaPoints({ map: softSprite(), size: 0.13, color: "#e8fbff", fog: false }),
    };
  }, []);
  const off = carried4(k);
  const sp = speed4(k);
  const SPAN = 16;
  const sa = sys.seg.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sys.N; i++) {
    const [a, b, c, d] = sys.rnd[i];
    const v = 0.7 + 0.6 * d;
    const x = cx - SPAN / 2 + ((((a * SPAN - off * v) % SPAN) + SPAN) % SPAN);
    const y = 0.15 + b * (SURF_Y - 0.5) + 0.06 * Math.sin(k * 0.2 + c * 9);
    const z = -3 + c * 6.5;
    const len = 0.04 + sp * v * 2.2;
    sa.setXYZ(i * 2, x, y, z);
    sa.setXYZ(i * 2 + 1, x + len, y + 0.01, z);
  }
  sa.needsUpdate = true;
  sys.segM.opacity = 0.35 + 0.5 * Math.min(1, sp * 3);
  const ba = sys.bub.attributes.position as THREE.BufferAttribute;
  const bA = sys.bub.attributes.aAlpha as THREE.BufferAttribute;
  for (let i = 0; i < sys.B; i++) {
    const [a, b, c, d] = sys.rnd[i];
    const x = cx - SPAN / 2 + ((((b * SPAN - off * (1.1 + 0.4 * a)) % SPAN) + SPAN) % SPAN);
    const y = 0.4 + ((a * (SURF_Y - 0.6) + k * (0.02 + 0.02 * c)) % (SURF_Y - 0.6));
    ba.setXYZ(i, x, y, -2.5 + d * 5.5);
    bA.setX(i, 0.75);
  }
  ba.needsUpdate = bA.needsUpdate = true;
  return (
    <group>
      <lineSegments geometry={sys.seg} material={sys.segM} frustumCulled={false} renderOrder={8} />
      <points geometry={sys.bub} material={sys.bubM} frustumCulled={false} renderOrder={9} />
    </group>
  );
};
/** the foam line where the waves break: a churning curtain of white bubbles from the surface down */
const FoamLine4: React.FC<{ k: number }> = ({ k }) => {
  const sys = useMemo(() => {
    const N = 1100;
    const r = rng(57);
    const rnd = Array.from({ length: N }, () => [r(), r(), r(), r()]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(N), 1));
    return { N, rnd, g, m: alphaPoints({ map: softSprite(), size: 0.22, color: "#ffffff", fog: false }) };
  }, []);
  const pa = sys.g.attributes.position as THREE.BufferAttribute;
  const aa = sys.g.attributes.aAlpha as THREE.BufferAttribute;
  for (let i = 0; i < sys.N; i++) {
    const [a, b, c, d] = sys.rnd[i];
    // denser near the surface, thinning out downwards; swirling and pulled left
    const depth = Math.pow(b, 1.6) * (SURF_Y - 0.6);
    const life = (k * (0.012 + 0.02 * d) + a) % 1;
    const x = EDGE + (c - 0.5) * 1.3 - life * 1.4 + 0.25 * Math.sin(k * 0.15 + d * 20);
    const y = SURF_Y - 0.1 - depth + 0.15 * Math.sin(k * 0.2 + a * 30);
    pa.setXYZ(i, x, y, -3 + d * 6.5);
    aa.setX(i, (1 - depth / (SURF_Y - 0.6)) * Math.sin(Math.PI * life) * 0.9);
  }
  pa.needsUpdate = aa.needsUpdate = true;
  return <points geometry={sys.g} material={sys.m} frustumCulled={false} renderOrder={10} />;
};
// dead rocks on the lagoon side, live corals and rocks past the foam line (the outer reef starts there)
const ROCKS4 = (() => {
  const r = rng(29);
  return Array.from({ length: 12 }, (_, i) => ({ p: V(X4 - 4 + i * 1.3 + r() * 0.6, 0.1, -1.0 - r() * 3.2), s: V(0.5 + r() * 0.6, 0.3 + r() * 0.35, 0.45 + r() * 0.5), seed: 4 + (i % 4) }));
})();
const OUTER = (() => {
  const r = rng(63);
  const pal = ["#f08fb0", "#a987e0", "#f29a5c", "#edc866"];
  return Array.from({ length: 12 }, (_, i) => ({ kind: [1, 2, 3, 4][i % 4], x: EDGE + 0.6 + i * 0.75 + r() * 0.5, z: -1.2 - r() * 3, s: 0.45 + r() * 0.45, rot: r() * 6.28, color: pal[i % 4], seed: 1 + (i % 3) }));
})();
const Scene4: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const cx = cam4X(f);
  const fx = fish4X(f);
  const fy = FISH4_Y + 0.07 * Math.sin(f * 0.13);
  const dragging = f >= PU4 && f < PU4 + DRAG4 + 6;
  const close = ip(f, IN4, IN4 + 16, 0, 1, out);
  // a slow push-in while it advances (no 5 s still frame), closer again when it insists
  const d = ip(f, 0, PU4, 7.6, 6.6, Easing.inOut(Easing.sin)) - 1.3 * close;
  const shake = dragging ? V(0.05 * Math.sin(f * 2.1), 0.04 * Math.sin(f * 2.7 + 1), 0) : V(0, 0, 0);
  const cam: Cam = { pos: V(cx + 0.15, fy - 0.5, d).add(shake).add(drift(f, 0.02)), target: V(cx, fy + 0.2, 0), fov: 50, roll: 0.015 * Math.sin(f * 0.05) };
  // tail beating fast all the time; harder while it is dragged back
  const swim = f < PU4 ? 1.7 : f < IN4 ? 2.6 : 2.2;
  const roll = dragging ? 0.1 * Math.sin((f - PU4) * 0.6) : 0.03 * Math.sin(f * 0.4);
  const pitch = dragging ? -0.08 : 0.02;
  const surf = surfMat4();
  surf.uniforms.uTime.value = t;
  return (
    <>
      <Rig {...cam} />
      <ReefEnv t={t} cam={cam.pos} dim={0.35} rays={0} floor={false} />
      <Seabed cam={cam.pos} />
      <fogExp2 attach="fog" args={[FOG4, 0.065]} />
      <mesh material={deepMat4()} position={cam.pos}>
        <sphereGeometry args={[110, 24, 16]} />
      </mesh>
      <mesh material={surf} rotation={[-Math.PI / 2, 0, 0]} position={[cx, SURF_Y, 3.5]} renderOrder={4}>
        <planeGeometry args={[40, 11, 200, 40]} />
      </mesh>
      {ROCKS4.map((rk, i) => (
        <Rock3 key={i} seed={rk.seed + i} position={rk.p} scale={0.55 + 0.25 * rk.s.x} rot={i * 1.7} />
      ))}
      {OUTER.map((it, i) => (
        <Coral key={i} item={it} />
      ))}
      <FoamLine4 k={f} />
      <Current4 k={f} cx={cx + 1.5} />
      <FishLights fish={V(fx, fy, 0)} cam={cam.pos} rim={0.8} />
      <ColorFish t={t} swim={swim} position={V(fx, fy, 0)} rotation={[roll, 0, pitch]} scale={0.75} open={0.32} look={[0.35, 0.05]} worry={f >= PU4 ? 0.7 : 0.25} />
    </>
  );
};
// ---------------------------------------------------------------------------
// Scenes 5-6: the outer reef (deeper, clearer, live corals, a school of small fish).
// The females without their male; then you are the biggest: the colours change; you lead the group
// ---------------------------------------------------------------------------
const R5 = V(-28, 2.4, -1.6); // the empty spot in the middle of the group
const FEM5 = [V(-2.0, 0.3, -0.6), V(1.9, -0.2, -0.9), V(-0.9, -0.8, 0.3), V(1.0, 0.75, 0.2)];
const Scene5: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const AR = C5_ARRIVE - S[4];
  const GR = C5_GROUP - S[4];
  const rise = ip(f, 0, SCENE_DURATIONS[4], 0.2, 2.2, Easing.inOut(Easing.quad));
  // you swim in from the left and slow down at the edge of the group
  const fp = V(ip(f, AR - 30, GR + 30, -35, -31.8, out), 2.2 + 0.05 * Math.sin(f * 0.1), 1.0);
  const target = f < GR ? V(ip(f, 0, GR, -31.5, -30.5), 2.4 + rise * 0.15, 0) : V(ip(f, GR, GR + 30, -30.5, -29.4, out), 2.4 + rise * 0.15, -0.6);
  const cam: Cam = { pos: target.clone().add(V(-0.4, 0.2 + rise, 9.4 - 0.4 * rise)).add(drift(f, 0.03)), target, fov: 40 };
  return (
    <>
      <Rig {...cam} />
      <Underwater t={t} cam={cam.pos} shafts={1.1} />
      <Scenery x={R5.x} t={t} range={18} seed={5} />
      <School f={f} center={R5.clone().add(V(0, 1.8, -5))} />
      <FishLights fish={R5.clone().add(V(-1.5, 0, 1))} cam={cam.pos} />
      {FEM5.map((p, i) => {
        const w = wander(f, i);
        return <ColorFish key={i} t={t + i * 0.41} swim={0.55} position={R5.clone().add(p).add(w.d)} rotation={[0, w.yaw, 0]} scale={0.72} palette={FEMALES[i]} paletteKey={`p3fem${i}`} look={[0.4 * Math.sin(f * 0.05 + i), 0.1]} worry={0.4} />;
      })}
      {f >= AR - 30 && <ColorFish t={t} swim={ip(f, GR, GR + 30, 1, 0.5)} position={fp} look={[0.3, 0]} />}
    </>
  );
};
const P6 = R5.clone().add(V(-0.2, 0.0, 1.2));
const Scene6: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const AW = C6_ARROW - S[5];
  const CO = C6_COLORS - S[5];
  const LE = C6_LEAD - S[5];
  const color = ip(f, CO, CO + COLOR_FRAMES, 0, 1, Easing.linear);
  const lead = ip(f, LE, LE + 40, 0, 1, Easing.inOut(Easing.quad));
  // you (bigger) in the middle of the females; when you lead, everyone swims forward (+x) behind you
  const go = (f >= LE ? (f - LE) * 0.035 * lead : 0);
  const fp = P6.clone().add(V(go, 0.04 * Math.sin(f * 0.09), 0));
  let cam: Cam;
  if (f < CO) {
    // a slow push-in and a small orbit through "Sem ele… poucas semanas" (no still frame), ending on the arrow framing
    cam = orbit(fp, ip(f, 0, AW, 0.4, 0.22, Easing.inOut(Easing.sin)), ip(f, 0, AW, 8.0, 6.4, Easing.inOut(Easing.sin)), 0.5, V(0.1, 0.1, -0.4), 40);
  } else if (f < LE) {
    // closer, side: the colour wave from head to tail
    // the WHOLE fish (tail included, head clear of the right 160 px) while the colour wave runs head -> tail
    cam = orbit(fp, 0.15, ip(f, CO, CO + 12, 6.4, 8.4, out), 0.25, V(0.02, 0.0, 0), 38);
  } else {
    // slow orbit, rising, the group following you
    cam = orbit(fp, ip(f, LE, LE + 80, 0.15, 0.55), ip(f, LE, LE + 40, 8.4, 8.0, out), ip(f, LE, LE + 80, 0.25, 3.0), V(ip(f, LE, LE + 40, 0.02, -0.6), -0.2, -0.3), 40);
  }
  cam.pos.add(drift(f, 0.025));
  // the females: aimless at first, then they come close and follow behind you in a loose V
  const follow = [V(-1.6, 0.45, -0.9), V(-1.7, -0.45, -1.1), V(-3.0, 0.75, -1.6), V(-3.1, -0.65, -1.7)];
  return (
    <>
      <Rig {...cam} />
      <Underwater t={t} cam={cam.pos} shafts={1.1} />
      <Scenery x={fp.x} t={t} range={18} seed={5} />
      <School f={f + SCENE_DURATIONS[4]} center={R5.clone().add(V(0, 1.8, -5))} />
      <FishLights fish={fp} cam={cam.pos} />
      {FEM5.map((p, i) => {
        const w = wander(f + SCENE_DURATIONS[4], i);
        const free = R5.clone().add(p).add(w.d);
        const behind = fp.clone().add(follow[i]).add(V(0.08 * Math.sin(f * 0.07 + i), 0.05 * Math.sin(f * 0.09 + i * 2), 0));
        const pos = free.lerp(behind, lead);
        // the ones facing the other way turn through "away from the camera" (yaw pi -> pi/2 -> 0), never towards it
        const yaw = interpolate(lead, [0, 1], [w.yaw, 0.12], clamp);
        return <ColorFish key={i} t={t + i * 0.41} swim={0.55 + 0.6 * lead} position={pos} rotation={[0, yaw, 0]} scale={0.72} palette={FEMALES[i]} paletteKey={`p3fem${i}`} look={[0.3, 0]} worry={0.4 * (1 - lead)} />;
      })}
      <ColorFish t={t} swim={0.6 + 0.5 * lead} position={fp} colorMode={color} look={[0.3, 0]} />
      {color > 0 && color < 1 && <pointLight position={fp.clone().add(V(-1.2 + 2.4 * color, 0.6, 1.5))} intensity={1.6 * Math.sin(Math.PI * color)} color="#c8fff0" distance={4} />}
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 7: the food becomes sand. Close-up on live coral, the sand cloud, the pile, the time-lapse beach
// ---------------------------------------------------------------------------
const X7 = 6;
const BRAIN7 = { kind: 1, x: X7 + 1.12, z: -0.2, s: 0.6, rot: 0.6, color: "#d8c29b", seed: 2 };
const GrowingIsland: React.FC<{ t: number; R: number; palms: number; light: number }> = ({ t, R, palms, light }) => {
  const water = useMemo(waterMat, []);
  water.uniforms.uTime.value = t;
  water.uniforms.uIsland.value = R * 1.02;
  water.uniforms.uSand.value = 1;
  const mats = useMemo(
    () => ({
      sand: new THREE.MeshStandardMaterial({ color: "#ffefc8", roughness: 1, emissive: new THREE.Color("#ffe9b8"), emissiveIntensity: 0.2 }),
      trunk: new THREE.MeshStandardMaterial({ color: "#8a6a48", roughness: 0.9 }),
      leaf: new THREE.MeshStandardMaterial({ color: "#3db34a", roughness: 0.7, side: THREE.DoubleSide }),
    }),
    [],
  );
  const g = palmGeo(1);
  return (
    <group>
      <color attach="background" args={["#0a63b0"]} />
      <hemisphereLight args={["#ffffff", "#8fe0d8", 1.5 * light]} />
      <directionalLight position={[8, 20, 6]} intensity={2.4 * light} color="#fff4d6" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={water}>
        <planeGeometry args={[500, 500]} />
      </mesh>
      {R > 0.05 && <mesh geometry={islandGeo()} material={mats.sand} scale={[R, 0.25 + 0.12 * R, R]} position={[0, -0.02, 0]} />}
      {palms > 0.01 && (
        <group position={[0.2, 0.25 + 0.12 * R - 0.05, -0.2]} scale={0.9 * palms} rotation={[0.04 * Math.sin(t * 1.7), 0, 0.03 * Math.sin(t * 1.3)]}>
          <mesh geometry={g.trunk} material={mats.trunk} />
          {g.fronds.map((fr, i) => (
            <mesh key={i} geometry={fr} material={mats.leaf} />
          ))}
        </group>
      )}
    </group>
  );
};
const Scene7: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const SA = C7_SAND - S[6];
  const LA = C7_LAPSE - S[6];
  const TO = C7_TONS - S[6];
  const END = SCENE_DURATIONS[6];
  if (f >= LA) {
    // time-lapse from above: the sand piles up into a white beach, faster from "toneladas"
    const k = f - LA;
    const p1 = ip(k, 0, TO - LA, 0, 0.35, Easing.linear);
    const p2 = ip(f, TO, END, 0, 1, Easing.in(Easing.quad));
    const grow = p1 + 0.65 * p2;
    const R = 0.4 + 4.6 * grow;
    const day = 0.85 + 0.15 * Math.sin(k * (0.35 + 0.6 * p2)); // the light flickers like days passing
    const h = 22 - 4 * grow;
    const a = 0.5 + k * 0.004;
    return (
      <>
        <Rig pos={V(Math.sin(a) * h * 0.75, h, Math.cos(a) * h * 0.75)} target={V(0, 0.4, 0)} fov={40} />
        <GrowingIsland t={t * (1 + 3 * p2)} R={R} palms={ip(grow, 0.7, 0.95, 0, 1)} light={day} />
      </>
    );
  }
  const male = 1;
  if (f < SA) {
    // close, side: biting the live coral
    const bites = [6, 20, 34].map((b) => b);
    const near = bites.reduce((m, b) => Math.min(m, Math.abs(f - b)), 99);
    const before = bites.some((b) => f < b && b - f <= 5);
    const open = near <= 1 ? 0 : before ? 0.6 : 0.35;
    // nose-down on the coral under the beak, 3/4 side view, the whole head in the frame
    const fp = V(X7, 0.86 + 0.02 * Math.sin(f * 0.1), 0);
    const cam = orbit(fp.clone().add(V(0.1, 0, 0)), 0.42, 5.4, 0.45, V(0.1, -0.7, 0), 40);
    cam.pos.add(drift(f, 0.015));
    return (
      <>
        <Rig {...cam} />
        <Underwater t={t} cam={cam.pos} />
        <Scenery x={X7} t={t} seed={7} clear={(x, z) => Math.abs(x - BRAIN7.x) < 1.6 && z > -2.2} />
        <FishLights fish={fp} cam={cam.pos} />
        <Coral item={BRAIN7} />
        <ColorFish t={t} swim={0.35} position={fp.clone().add(V(near <= 2 ? 0.05 : 0, 0, 0))} rotation={[0, 0, -0.25]} open={open} colorMode={male} look={[0.3, -0.3]} />
      </>
    );
  }
  const X7C = X7 + 6; // a clear stretch of sand next to the coral
  const FS = 0.8; // the fish a little smaller so it stays whole in the frame while it swims across
  const fish7 = (tm: number) => V(X7C - 0.55 + 0.65 * ip(tm, SA, LA, 0, 1, Easing.linear), 1.9 + 0.04 * Math.sin(tm * 0.1), 0.3); // head never in the right 160 px
  const vent = (tm: number) => fish7(tm).add(VENT.clone().multiplyScalar(FS));
  const pile = ip(f, SA + 10, LA, 0, 1, Easing.inOut(Easing.quad));
  const cam: Cam = { pos: V(X7C + 0.05, 1.5, 7.5).add(drift(f, 0.02)), target: V(X7C - 0.05, 1.0, 0), fov: 40 };
  return (
    <>
      <Rig {...cam} />
      <Underwater t={t} cam={cam.pos} />
      <Scenery x={X7C} t={t} seed={7} clear={(x, z) => Math.abs(x - X7C + 0.6) < 1.6 && z > -1.8} />
      <FishLights fish={fish7(f)} cam={cam.pos} />
      <ColorFish t={t} swim={0.9} position={fish7(f)} scale={FS} colorMode={male} look={[0.3, 0]} />
      {/* a dense white cloud of sand grains from behind the fish, sinking onto the growing pile */}
      <SandCloud f={f} from={SA - 4} to={LA} emitter={vent} count={3600} seed={1} push={0.02} spread={0.9} fall={0.016} size={2.6} floorY={0.15} />
      <SandCloud f={f} from={SA - 4} to={LA} emitter={vent} count={2400} seed={2} push={0.015} spread={0.6} fall={0.02} size={1.9} floorY={0.15} />
      <Mound grow={pile} position={[X7C - 0.6, 0.02, 0.3]} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 8: the little island with one palm; you swim in front of it, under clear shallow water
// ---------------------------------------------------------------------------
const ISL8 = V(0, -1.6, -4.6);
const Scene8: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  const FE = C8_FEMEA - S[7];
  const MA = C8_MACHO - S[7];
  // in front of the island, under the water, left to right, side view, the whole fish always in the frame
  // ... and when the camera zooms into the island it swims out of the frame to the right (never cut standing still)
  const ZS = C8_BUILD - S[7];
  const fx8 = f < ZS ? ip(f, 0, ZS, -1.05, 0.75, Easing.linear) : 0.75 + ip(f, ZS, ZS + 26, 0, 4.2, Easing.in(Easing.quad));
  const fp = V(fx8, -0.62 + 0.04 * Math.sin(f * 0.1), -2.0 + 0.15 * Math.sin(f * 0.02));
  const yaw = 0.06 * Math.sin(f * 0.03);
  // "nasceu fêmea": the old colours for a moment; "virou macho": the wave again, quick
  const color = f >= FE - 1 && f < MA ? 0 : f >= MA ? ip(f, MA, MA + 14, 0, 1, Easing.linear) : 1;
  // "construiu uma ilha": a zoom into the island in the back, landing on "ilha" and holding until the ending
  const zoom = ip(f, C8_BUILD - S[7], C8_ILHA - S[7] + 10, 0, 1, Easing.inOut(Easing.cubic));
  // wide: the island (sand mound) between ~800 and ~910 px, the palm whole above it (below the labels), the fish
  // under the water around y ~1150. Zoom: the island bigger, sand ~940-1100 px, the crown still under the labels.
  const wide: Cam = { pos: V(-0.2 + f * 0.002, 2.2 + 0.03 * Math.sin(t * 0.9), 6.0), target: V(0, -0.24, ISL8.z), fov: 50 };
  const cam: Cam = {
    pos: wide.pos.clone().lerp(V(0.2, 1.8, 5.0), zoom),
    target: wide.target.clone().lerp(V(0, 0.52, ISL8.z), zoom),
    fov: 50 - 10 * zoom,
  };
  return (
    <>
      <Rig {...cam} />
      <IslandSet t={t} isle={ISL8} size={0.7} height={2.2} palms={[{ seed: 1, at: [0.1, -0.15], s: 0.79 }]} clear={0.16} rocks sun={[-7, 10, -1.5]}>
        <ColorFish t={t} swim={0.9} position={fp} rotation={[0, yaw, 0]} scale={0.9} colorMode={color} look={[0.3, 0]} />
        <pointLight position={fp.clone().add(V(-1.2, 0.8, -1.2))} color="#5fe8cf" intensity={3} distance={2.5} />
        <Bubbles t={t} origin={[fp.x + 0.8, fp.y + 0.2, fp.z]} count={6} rate={0.9} size={0.08} />
      </IslandSet>
    </>
  );
};

export const Papagaio3Scene: React.FC = () => {
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
      shadows
      style={{ backgroundColor: sc === 1 || sc === 7 ? "#2b77a8" : "#126a86" }}
    >
      {sc === 0 && <Scene1 f={f} />}
      {sc === 1 && <Scene2 f={f} />}
      {sc === 2 && <Scene3 f={f} />}
      {sc === 3 && <Scene4 f={f} />}
      {sc === 4 && <Scene5 f={f} />}
      {sc === 5 && <Scene6 f={f} />}
      {sc === 6 && <Scene7 f={f} />}
      {sc === 7 && <Scene8 f={f} />}
    </ThreeCanvas>
  );
};
