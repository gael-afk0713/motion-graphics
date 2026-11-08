import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RocketStage } from "./Rocket";
import {
  getFuelIcon,
  getMoonTextures,
  getRegolithTextures,
  getSoftSprite,
  groundHeight,
  makeSpaceEnv,
  rng,
} from "./textures";
import {
  DURATION,
  FPS,
  IMPACT,
  IMPACT5,
  S,
  sceneEnd,
  sceneOf,
} from "./timeline";
import { useNasaTextures } from "./nasa";

type Nasa = NonNullable<ReturnType<typeof useNasaTextures>>;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.inOut(Easing.cubic);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const noise1 = (f: number, seed: number) => {
  const r = rng(Math.floor(f) * 7919 + seed * 104729);
  return r() * 2 - 1;
};

// ---------------------------------------------------------------------------
// Cuts inside scenes (something changes every 2-3 s)
// ---------------------------------------------------------------------------
export const CUT1 = 79; // scene 1: "E ninguém queria isso." -> side tracking shot
export const CUT2 = S[1] + 57; // scene 2: "que ficou..." -> close orbit near the engine
export const CUT3 = S[2] + 84; // scene 3: "O Sol e a gravidade" -> tilted map view
export const CUT4 = S[3] + 82; // scene 4: "e deve ter aberto" -> camera pulls back, smoking crater
export const CUT5A = IMPACT5; // scene 5: impact -> ripples
export const CUT5B = S[4] + 153; // scene 5: "para medir os tremores lunares" -> high wide view
export const CUTS = [CUT1, CUT2, CUT3, CUT4, CUT5A, CUT5B];

// ---------------------------------------------------------------------------
// Space set (scenes 1, 2, 6): Moon radius 100 at the origin, sun from the right
// ---------------------------------------------------------------------------
const MOON_R = 100;
const SUN_SPACE = V(1, 0.2, 0.55).normalize();
// NASA map: longitude 0 sits on local +x; -PI/2 turns the near side towards the camera (+z)
const MOON_ROT0 = -Math.PI / 2 + 0.25;
const SUN_AZ = Math.atan2(SUN_SPACE.x, SUN_SPACE.z);
// Scene 1 path: the camera flies straight at the Moon (frame 0 already in motion)
const CAM_SPEED = 1.6; // units per frame
const camZ1 = (f: number) => 640 - CAM_SPEED * f;
const ROCKET_REL = V(4.4, -13.5, -64); // rocket relative to the camera on frame 0 (lower right)
const LOOK1 = V(0, -50, 0);
const moonRot = (f: number) => {
  if (sceneOf(f) === 5) return MOON_ROT0 + (f - DURATION) * 0.0035;
  return MOON_ROT0 + f * 0.0008;
};
const rocket1World = (f: number) =>
  V(
    ROCKET_REL.x + Math.sin(f * 0.04) * 0.6 + Math.sin(f * 0.05) * 0.15,
    -8 + ROCKET_REL.y + Math.sin(f * 0.07) * 0.1,
    camZ1(f) + ROCKET_REL.z - 0.03 * f,
  );
// nose pointing diagonally (up-left on screen) towards the Moon
const rocket1Quat = (f: number) =>
  yTo(V(-0.42, 0.45, -1)).multiply(
    new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.4 + f * 0.004),
  );

// ---------------------------------------------------------------------------
// Map set (scene 3)
// ---------------------------------------------------------------------------
const MAP_MOON_R = 30;
const P0 = V(95, 0, 120);
const T0 = V(-0.42, 0, -1).normalize();
const SUN_MAP_POS = V(-330, 40, -520);
const bendAt = (f: number) =>
  interpolate(f, [S[2] + 18, S[2] + 80, S[2] + 165], [0, 0.22, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
const pathAt = (s: number, m: number) => {
  const miss = P0.clone().addScaledVector(T0, s * 320);
  const c = P0.clone().addScaledVector(T0, 95);
  const u = 1 - s;
  const hit = P0.clone()
    .multiplyScalar(u * u)
    .addScaledVector(c, 2 * u * s)
    .addScaledVector(V(0, 0, 0), s * s);
  return miss.lerp(hit, m);
};
const rocketS3 = (f: number) =>
  interpolate(f, [S[2], sceneEnd(2)], [0.0, 0.1], clamp);

// ---------------------------------------------------------------------------
// Surface set (scenes 4, 5): impact at the origin, low sun from the right
// ---------------------------------------------------------------------------
const SUN_GROUND = V(1, 0.3, 0.22).normalize();
const H0 = groundHeight(0, 0);
const DIVE_FROM = V(-0.55, 0.62, -0.56).normalize();
const diveDist = (f: number) => Math.max(0, (IMPACT - f) * 5.2);
const CRATER_R = 10;
const craterAt = (f: number) =>
  sceneOf(f) === 3
    ? interpolate(f, [IMPACT, IMPACT + 50], [0, 1], {
        ...clamp,
        easing: Easing.out(Easing.cubic),
      })
    : 0;
const slowT = (f: number, at: number) => Math.max(0, (f - at) / FPS) * 0.32; // slow-motion seconds after impact
const STAGE5_FROM = V(0.35, 1, 0.2).normalize();
const stage5Dist = (f: number) =>
  interpolate(f, [S[4], IMPACT5], [150, 0], {
    ...clamp,
    easing: Easing.in(Easing.quad),
  });

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
type Pose = { p: THREE.Vector3; t: THREE.Vector3; fov: number; roll: number };
const shake = (f: number, at: number, amp: number, decay: number) => {
  if (f < at) return V(0, 0, 0);
  const a = amp * Math.exp(-(f - at) / decay);
  return V(noise1(f, 1) * a, noise1(f, 2) * a, noise1(f, 3) * a * 0.6);
};

// scene 1 opening shot; also used with negative frames by scene 6 so the loop is seamless
const shotA1 = (g: number): Pose => ({
  p: V(Math.sin(g * 0.04) * 0.6, -8 + Math.sin(g * 0.03) * 0.4, camZ1(g)),
  t: LOOK1,
  fov: 40,
  roll: Math.sin(g * 0.02) * 0.02,
});

export const cameraPose = (f: number): Pose => {
  const sc = sceneOf(f);
  if (sc === 0) {
    if (f < CUT1) return shotA1(f);
    const k = f - CUT1;
    const r = rocket1World(f);
    return {
      p: r.clone().add(V(2.4 - 0.01 * k, 5.2 - 0.02 * k, 15 - 0.07 * k)),
      t: V(0, -30, 0),
      fov: 42,
      roll: -0.1 + k * 0.0015,
    };
  }
  if (sc === 1) {
    const k = f - S[1];
    if (f < CUT2) {
      // side-lit by the sun, the Moon far behind
      const a = 0.2 + 0.006 * k;
      return {
        p: V(50 * Math.sin(a), 6 + 0.03 * k, 50 * Math.cos(a)),
        t: V(0, 0, 0),
        fov: 36,
        roll: 0.05,
      };
    }
    // against the sun: rim light and glints on the metal, sun flare beside the stage
    const j = f - CUT2;
    const a = SUN_AZ + Math.PI - 1.75 + 0.005 * j;
    return {
      p: V(27 * Math.sin(a), -6 + 0.04 * j, 27 * Math.cos(a)),
      t: V(0, 1, 0),
      fov: 38,
      roll: -0.08,
    };
  }
  if (sc === 2) {
    const k = f - S[2];
    // rocket at the bottom, Moon at the top of the frame (camera behind the rocket, high above)
    if (f < CUT3)
      return {
        p: V(133 - 0.12 * k, 235 - 0.4 * k, 167 - 0.15 * k),
        t: V(43, 0, 54),
        fov: 40,
        roll: 0,
      };
    const j = f - CUT3;
    return {
      p: V(166 - 0.2 * j, 72 - 0.08 * j, 208 - 0.25 * j),
      t: V(-10, 0, -20),
      fov: 40,
      roll: 0.03,
    };
  }
  if (sc === 3) {
    const sh = shake(f, IMPACT, 2.2, 9);
    if (f < CUT4) {
      const k = f - S[3];
      const r = DIVE_FROM.clone()
        .multiplyScalar(diveDist(f))
        .add(V(0, H0, 0));
      const look =
        f < IMPACT
          ? r.clone().lerp(V(0, H0, 0), 0.5)
          : V(0, H0 + 4 + 2 * slowT(f, IMPACT) * 6, 0);
      const back =
        f < IMPACT
          ? 0
          : interpolate(f, [IMPACT, CUT4], [0, 1], {
              ...clamp,
              easing: Easing.out(Easing.quad),
            });
      return {
        p: V(30 + 7 * back, H0 + 8 + 6 * back - 0.03 * k, 34 + 8 * back).add(
          sh,
        ),
        t: look.add(sh.clone().multiplyScalar(0.5)),
        fov: 50,
        roll: -0.03,
      };
    }
    const j = f - CUT4;
    const pull = interpolate(j, [0, sceneEnd(3) - CUT4], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.quad),
    });
    return {
      p: V(30 + 22 * pull, H0 + 62 + 40 * pull, 55 + 40 * pull).add(sh),
      t: V(0, H0 + 1, 0),
      fov: 44,
      roll: 0.02,
    };
  }
  if (sc === 4) {
    const k = f - S[4];
    const sh = shake(f, IMPACT5, 1.0, 8);
    if (f < CUT5A) {
      const st = STAGE5_FROM.clone()
        .multiplyScalar(stage5Dist(f))
        .add(V(0, H0, 0));
      const camY = Math.max(H0 + 26, st.y + 6);
      return {
        p: V(st.x - 46, camY, st.z + 52),
        t: st.clone().add(V(0, -10, 0)),
        fov: 44,
        roll: -0.03 + k * 0.0004,
      };
    }
    if (f < CUT5B) {
      const j = f - CUT5A;
      return {
        p: V(-55 - 0.05 * j, H0 + 30 + 0.05 * j, 68 + 0.08 * j).add(sh),
        t: V(0, H0, 0),
        fov: 46,
        roll: 0,
      };
    }
    const j = f - CUT5B;
    return {
      p: V(-20 - 0.2 * j, H0 + 135 + 0.5 * j, 150 + 0.4 * j),
      t: V(0, H0, -8),
      fov: 44,
      roll: 0,
    };
  }
  // scene 6: the Moon turns, the camera advances; ends on scene 1's starting pose (loop)
  return shotA1(f - DURATION);
};

const CameraRig: React.FC<{ pose: Pose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.copy(pose.p);
  camera.up.set(Math.sin(pose.roll), Math.cos(pose.roll), 0);
  camera.lookAt(pose.t);
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

// ---------------------------------------------------------------------------
// Shared elements
// ---------------------------------------------------------------------------
const Stars: React.FC<{ center: THREE.Vector3; dim?: number }> = ({
  center,
  dim = 1,
}) => {
  const layers = useMemo(() => {
    const r = rng(11);
    return [0.9, 1.4, 2.2].map((size, li) => {
      const n = [5200, 1400, 260][li];
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = r() * 2 - 1,
          a = r() * Math.PI * 2,
          s = Math.sqrt(1 - u * u);
        pos.set(
          [4000 * s * Math.cos(a), 4000 * u, 4000 * s * Math.sin(a)],
          i * 3,
        );
        const b = 0.35 + 0.65 * r() ** 2;
        const tint = r();
        col.set(
          tint < 0.2
            ? [b * 0.8, b * 0.88, b]
            : tint > 0.88
              ? [b, b * 0.88, b * 0.75]
              : [b, b, b],
          i * 3,
        );
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      return { g, size };
    });
  }, []);
  return (
    <group position={center}>
      {layers.map((l, i) => (
        <points key={i} geometry={l.g} frustumCulled={false}>
          <pointsMaterial
            size={l.size}
            sizeAttenuation={false}
            vertexColors
            transparent
            opacity={dim}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      ))}
    </group>
  );
};

// fine specks streaking past the camera (sells the speed)
const SpeedDust: React.FC<{
  cam: THREE.Vector3;
  frame: number;
  speed: number;
  opacity: number;
}> = ({ cam, frame, speed, opacity }) => {
  const base = useMemo(() => {
    const r = rng(23);
    return Array.from(
      { length: 260 },
      () => [(r() - 0.5) * 70, (r() - 0.5) * 120, r() * 160] as const,
    );
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(base.length * 6), 3),
    );
    return g;
  }, [base]);
  const arr = geom.attributes.position.array as Float32Array;
  base.forEach(([x, y, z0], i) => {
    const z = ((z0 + frame * speed) % 160) - 150; // relative to camera, moving towards +z
    const len = speed * 1.6;
    arr.set(
      [cam.x + x, cam.y + y, cam.z + z - len, cam.x + x, cam.y + y, cam.z + z],
      i * 6,
    );
  });
  geom.attributes.position.needsUpdate = true;
  return (
    <lineSegments geometry={geom} frustumCulled={false}>
      <lineBasicMaterial
        color="#cfd8e6"
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </lineSegments>
  );
};

const Glow: React.FC<{
  position: THREE.Vector3;
  size: number;
  color: string;
  opacity?: number;
  kind?: "glow" | "dot";
}> = ({ position, size, color, opacity = 1, kind = "glow" }) => (
  <sprite position={position} scale={[size, size, 1]} renderOrder={10}>
    <spriteMaterial
      map={getSoftSprite(kind)}
      color={color}
      transparent
      opacity={opacity}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      toneMapped={false}
    />
  </sprite>
);

// sun disc + anamorphic streak, always at the same direction (infinitely far)
const Sun: React.FC<{
  cam: THREE.Vector3;
  dir: THREE.Vector3;
  scale?: number;
}> = ({ cam, dir, scale = 1 }) => {
  const p = cam.clone().addScaledVector(dir, 3000);
  return (
    <>
      <Glow position={p} size={900 * scale} color="#ffd2a0" opacity={0.55} />
      <Glow position={p} size={260 * scale} color="#fff4e6" />
      <sprite
        position={p}
        scale={[2600 * scale, 40 * scale, 1]}
        renderOrder={10}
      >
        <spriteMaterial
          map={getSoftSprite("glow")}
          color="#ffb070"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </>
  );
};

const Moon: React.FC<{
  radius: number;
  rotY: number;
  normalScale?: number;
  nasa?: Nasa;
}> = ({ radius, rotY, normalScale = 1, nasa }) => {
  const proc = nasa ? null : getMoonTextures();
  const map = nasa ? nasa.moonMap : proc!.map;
  const normal = nasa ? nasa.moonNormal : proc!.normal;
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map,
        normalMap: normal,
        normalScale: new THREE.Vector2(normalScale, normalScale),
        roughness: 1,
        metalness: 0,
      }),
    [map, normal, normalScale],
  );
  return (
    <mesh rotation={[0.12, rotY, 0.05]} material={mat}>
      <sphereGeometry args={[radius, 256, 128]} />
    </mesh>
  );
};

// neutral: no blue fill (scenes 1 and 6) -> the Moon's night side is only black/grey shadow
const SpaceLights: React.FC<{
  dir: THREE.Vector3;
  intensity?: number;
  neutral?: boolean;
}> = ({ dir, intensity = 3.4, neutral = false }) =>
  neutral ? (
    <>
      <directionalLight
        position={dir.clone().multiplyScalar(500)}
        intensity={intensity}
        color="#ffe6c8"
      />
      <ambientLight intensity={0.02} color="#ffffff" />
      {/* faint neutral fill from behind the camera (keeps the rocket readable) */}
      <directionalLight
        position={[-150, 60, 500]}
        intensity={0.12}
        color="#d8d8d8"
      />
    </>
  ) : (
    <>
      <directionalLight
        position={dir.clone().multiplyScalar(500)}
        intensity={intensity}
        color="#ffe0bd"
      />
      <ambientLight intensity={0.06} color="#5a7fd0" />
      <hemisphereLight args={["#20325c", "#000000", 0.12]} />
      {/* faint cool fill from behind the camera (keeps the rocket readable) */}
      <directionalLight
        position={[-150, 60, 500]}
        intensity={0.35}
        color="#7d9be0"
      />
    </>
  );

const useEnv = () => useMemo(() => makeSpaceEnv(SUN_SPACE), []);

// orient a group's +Y along `dir`
const yTo = (dir: THREE.Vector3, spin = 0) => {
  const q = new THREE.Quaternion().setFromUnitVectors(
    V(0, 1, 0),
    dir.clone().normalize(),
  );
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), spin));
};

// ---------------------------------------------------------------------------
// Scene 1 + 6: rocket flying at the Moon / Moon with our debris
// ---------------------------------------------------------------------------
// markers on the face seen by the camera (world dirs at mid scene 6, stored in Moon-local space)
const DEBRIS = (() => {
  const r = rng(77);
  const inv = new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(0.12, MOON_ROT0 - 45 * 0.0035, 0.05))
    .invert();
  return Array.from({ length: 13 }, () => {
    const d = V(-0.25 + 0.95 * r(), -0.55 + 1.0 * r(), 1).normalize();
    return { d: d.applyQuaternion(inv), ph: r() };
  });
})();

const SpaceSet: React.FC<{ frame: number; pose: Pose; nasa: Nasa }> = ({
  frame,
  pose,
  nasa,
}) => {
  const sc = sceneOf(frame);
  const env = useEnv();
  const rot = moonRot(frame);
  // scene 6 end: a new stage flies in and settles where scene 1 starts (seamless loop)
  let rocket: { p: THREE.Vector3; q: THREE.Quaternion } | null = null;
  if (sc === 0) {
    rocket = { p: rocket1World(frame), q: rocket1Quat(frame) };
  } else if (sc === 5) {
    const k = interpolate(frame, [DURATION - 22, DURATION], [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    });
    if (k > 0) {
      const g = frame - DURATION; // same path as scene 1, at negative frames
      const target = rocket1World(g);
      const from = V(15, -26, camZ1(g) + 8);
      rocket = { p: from.lerp(target, k), q: rocket1Quat(g) };
    }
  }
  const debrisOn =
    sc === 5
      ? interpolate(
          frame,
          [S[5] + 2, S[5] + 10, DURATION - 9, DURATION - 1],
          [0, 1, 1, 0],
          clamp,
        )
      : 0;
  return (
    <>
      <SpaceLights dir={SUN_SPACE} neutral />
      <Stars center={pose.p} />
      <Sun cam={pose.p} dir={SUN_SPACE} />
      <group>
        <Moon radius={MOON_R} rotY={rot} nasa={nasa} />
        {/* red glowing markers where our hardware lies */}
        {debrisOn > 0 && (
          <group rotation={[0.12, rot, 0.05]}>
            {DEBRIS.map(({ d, ph }, i) => {
              const p = d.clone().multiplyScalar(MOON_R + 0.6);
              const pulse = 0.75 + 0.25 * Math.sin(frame * 0.35 + ph * 6.28);
              const pop = interpolate(
                frame,
                [S[5] + 2 + i * 1.2, S[5] + 8 + i * 1.2],
                [0, 1],
                clamp,
              );
              return (
                <group key={i}>
                  <Glow
                    position={p}
                    size={22 * pop * pulse}
                    color="#ff2a1a"
                    opacity={0.9 * debrisOn}
                  />
                  <Glow
                    position={p}
                    size={6 * pop}
                    color="#ffd0c0"
                    opacity={debrisOn}
                    kind="dot"
                  />
                </group>
              );
            })}
          </group>
        )}
      </group>
      {rocket && (
        <group position={rocket.p} quaternion={rocket.q}>
          <RocketStage envMap={env} />
        </group>
      )}
      <SpeedDust
        cam={pose.p}
        frame={frame}
        speed={sc === 0 && frame >= CUT1 ? 2.4 : 1.6}
        opacity={0.35}
      />
    </>
  );
};

// a direction a little up and to the right of the view (sun glare in frame)
const glareDir = (pose: Pose) => {
  const fwd = pose.t.clone().sub(pose.p).normalize();
  const right = fwd
    .clone()
    .cross(V(0, 1, 0))
    .normalize();
  return fwd
    .addScaledVector(right, 0.15)
    .add(V(0, 0.26, 0))
    .normalize();
};

// ---------------------------------------------------------------------------
// Scene 2: the abandoned stage tumbling alone
// ---------------------------------------------------------------------------
const DriftSet: React.FC<{ frame: number; pose: Pose }> = ({ frame, pose }) => {
  const env = useEnv();
  const k = frame - S[1];
  return (
    <>
      <SpaceLights dir={SUN_SPACE} intensity={3.8} />
      {/* cool kicker from the shadow side for the close shot */}
      {frame >= CUT2 && (
        <directionalLight
          position={pose.p
            .clone()
            .add(V(0, 30, 0))
            .multiplyScalar(10)}
          intensity={0.9}
          color="#88a8ff"
        />
      )}
      <Stars center={pose.p} />
      {frame < CUT2 ? (
        <Sun cam={pose.p} dir={SUN_SPACE} scale={0.8} />
      ) : (
        <Sun cam={pose.p} dir={glareDir(pose)} scale={0.7} />
      )}
      {/* the Moon, small and far */}
      <group position={V(-0.3, 0.1, -0.95).normalize().multiplyScalar(2400)}>
        <Moon radius={230} rotY={1.3} />
      </group>
      {/* slow tumble: tilted, spinning around its own axis */}
      <group rotation={[0.25 + 0.002 * k, 0, 0.5 + 0.0035 * k]}>
        <group rotation={[0, 0.016 * k, 0]}>
          <RocketStage envMap={env} />
        </group>
      </group>
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 3: map view, the route bending into the Moon
// ---------------------------------------------------------------------------
const MapSet: React.FC<{ frame: number; pose: Pose }> = ({ frame, pose }) => {
  const env = useEnv();
  const m = bendAt(frame);
  const sr = rocketS3(frame);
  const rp = pathAt(sr, m);
  const tan = pathAt(sr + 0.01, m)
    .sub(rp)
    .normalize();
  const N = 40;
  const phase = (frame * 0.06) % 1;
  const dots: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const s = sr + 0.03 + ((i + phase) / N) * (1 - sr);
    const p = pathAt(s, m);
    if (p.length() < MAP_MOON_R + 0.8) continue;
    dots.push(p);
  }
  const ghost: THREE.Vector3[] = [];
  for (let i = 0; i < 45; i++)
    ghost.push(pathAt(sr + 0.03 + (i / 45) * 0.9, 0));
  const ghostOn = interpolate(m, [0.05, 0.3], [0, 0.35], clamp);
  const blink = Math.floor((frame - S[2]) / 6) % 2 === 0 ? 1 : 0.2;
  const iconOn = interpolate(frame, [S[2], S[2] + 4], [0, 1], clamp);
  const grav = interpolate(frame, [S[2] + 86, S[2] + 100], [0, 1], clamp);
  const sunDir = SUN_MAP_POS.clone().normalize();
  return (
    <>
      <directionalLight
        position={sunDir
          .clone()
          .multiplyScalar(300)
          .add(V(0, 380, 0))}
        intensity={3.6}
        color="#ffdcb4"
      />
      <ambientLight intensity={0.07} color="#5a7fd0" />
      <Stars center={pose.p} dim={0.7} />
      {/* the Sun shining in the background */}
      <Glow position={SUN_MAP_POS} size={900} color="#ffc890" opacity={0.6} />
      <Glow position={SUN_MAP_POS} size={260} color="#fff6ea" />
      <sprite position={SUN_MAP_POS} scale={[1800, 30, 1]}>
        <spriteMaterial
          map={getSoftSprite("glow")}
          color="#ffae6a"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      {/* map grid */}
      <gridHelper
        args={[900, 45, "#2c5d8f", "#1b3a5c"]}
        position={[0, -0.5, 0]}
      />
      {[60, 100, 150].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
          <ringGeometry args={[r - 0.35, r + 0.35, 160]} />
          <meshBasicMaterial
            color="#3d7ab8"
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* gravity: rings contracting into the Moon */}
      {grav > 0 &&
        [0, 1, 2].map((i) => {
          const t = ((frame - S[2]) / 40 + i / 3) % 1;
          const r = MAP_MOON_R + 75 * (1 - t);
          return (
            <mesh
              key={i}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.2, 0]}
            >
              <ringGeometry args={[r - 0.8, r + 0.8, 160]} />
              <meshBasicMaterial
                color="#8fc4ff"
                transparent
                opacity={grav * 0.55 * Math.sin(Math.PI * t)}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          );
        })}
      <Moon radius={MAP_MOON_R} rotY={0.6} normalScale={1.3} />
      {/* original route (faint) and the bent route (dotted) */}
      {ghost.map((p, i) => (
        <Glow
          key={`g${i}`}
          position={p}
          size={2.2}
          color="#9fb3c8"
          opacity={ghostOn}
          kind="dot"
        />
      ))}
      {dots.map((p, i) => (
        <Glow key={i} position={p} size={3} color="#ffffff" kind="dot" />
      ))}
      <group position={rp} quaternion={yTo(tan)} scale={0.75}>
        <RocketStage envMap={env} />
      </group>
      {/* empty fuel tank, blinking red */}
      <sprite
        position={rp.clone().add(V(-4, 20, 4))}
        scale={[22, 22, 1]}
        renderOrder={20}
      >
        <spriteMaterial
          map={getFuelIcon()}
          transparent
          opacity={iconOn * blink}
          depthTest={false}
          toneMapped={false}
        />
      </sprite>
      <Glow
        position={rp.clone().add(V(-4, 20, 4))}
        size={50}
        color="#ff2020"
        opacity={0.6 * iconOn * blink}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scenes 4 + 5: the lunar surface
// ---------------------------------------------------------------------------
const GRID = 340;
const warp = (u: number) => 1500 * (0.12 * u + 0.88 * u ** 5);
let groundBase: {
  pos: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
  r: Float32Array;
} | null = null;
const getGroundBase = () => {
  if (groundBase) return groundBase;
  const n = GRID + 1;
  const pos = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  const rr = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = warp((i / GRID) * 2 - 1),
        z = warp((j / GRID) * 2 - 1);
      const k = j * n + i;
      // mesh spacing grows with distance: fade crater relief out there (no jagged black facets)
      const far = Math.hypot(x, z);
      const cw = Math.max(0, Math.min(1, 1 - (far - 80) / 120));
      pos.set([x, groundHeight(x, z, cw), z], k * 3);
      uv.set([x / 5, z / 5], k * 2);
      rr[k] = Math.hypot(x, z);
    }
  const index = new Uint32Array(GRID * GRID * 6);
  let q = 0;
  for (let j = 0; j < GRID; j++)
    for (let i = 0; i < GRID; i++) {
      const a = j * n + i,
        b = a + 1,
        c = a + n,
        d = c + 1;
      index.set([a, c, b, b, c, d], q);
      q += 6;
    }
  groundBase = { pos, uv, index, r: rr };
  return groundBase;
};

// new crater shape (relative height), c = formation progress 0..1
const newCrater = (r: number, c: number) => {
  if (c <= 0) return 0;
  const R = CRATER_R * (0.35 + 0.65 * c);
  const d = r / R;
  if (d > 3) return 0;
  const depth = 4.2 * c;
  if (d < 1) return -depth * (1 - d * d) + 1.7 * c * Math.pow(d, 6);
  return (
    1.7 * c * Math.exp(-(((d - 1) / 0.3) ** 2)) +
    0.35 * c * Math.max(0, 1 - (d - 1) / 2)
  );
};
// seismic waves spreading like ripples on water
const RIPPLE_V = 34; // m/s
const RIPPLE_L = 16; // wavelength
const ripple = (r: number, t: number) => {
  if (t <= 0) return 0;
  const front = RIPPLE_V * t;
  if (r > front) return 0;
  const env =
    Math.min(1, (front - r) / 10) *
    Math.exp(-r / 160) *
    Math.min(1, t * 2) *
    Math.exp(-Math.max(0, t - 2.5) * 0.8);
  return 0.9 * env * Math.sin((2 * Math.PI * (r - front)) / RIPPLE_L);
};

const Ground: React.FC<{ frame: number }> = ({ frame }) => {
  const sc = sceneOf(frame);
  const tex = getRegolithTextures();
  const geom = useMemo(() => {
    const b = getGroundBase();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(b.pos.slice(), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(b.uv, 2));
    g.setIndex(new THREE.BufferAttribute(b.index, 1));
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: tex.map,
        normalMap: tex.normal,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughness: 1,
        metalness: 0,
        color: "#c2c2c2",
      }),
    [tex],
  );
  // per-frame deformation (stateless: rebuilt from the base every frame)
  const b = getGroundBase();
  const arr = geom.attributes.position.array as Float32Array;
  const c = craterAt(frame);
  const t5 = sc === 4 ? Math.max(0, (frame - IMPACT5) / FPS) : 0;
  const n = b.r.length;
  for (let k = 0; k < n; k++) {
    const r = b.r[k];
    let y = b.pos[k * 3 + 1];
    if (c > 0 && r < CRATER_R * 3) y += newCrater(r, c);
    if (t5 > 0) y += ripple(r, t5) + newCrater(r, 0.25);
    arr[k * 3 + 1] = y;
  }
  geom.attributes.position.needsUpdate = true;
  geom.computeVertexNormals();
  return <mesh geometry={geom} material={mat} receiveShadow castShadow />;
};

// bright crest lines riding on the ripples (scene 5)
const RippleRings: React.FC<{ frame: number }> = ({ frame }) => {
  const t = Math.max(0, (frame - IMPACT5) / FPS);
  const rings: { r: number; o: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const r = RIPPLE_V * t - (i + 0.25) * RIPPLE_L;
    if (r > 3)
      rings.push({
        r,
        o:
          Math.exp(-r / 220) *
          Math.min(1, (RIPPLE_V * t - r) / 12) *
          Math.exp(-Math.max(0, t - 2.5) * 0.6),
      });
  }
  return (
    <>
      {rings.map(({ r, o }, i) => {
        const seg = 160;
        const pos = new Float32Array((seg + 1) * 6);
        for (let s = 0; s <= seg; s++) {
          const a = (s / seg) * Math.PI * 2;
          for (const [w, off] of [
            [-0.9, 0],
            [0.9, 3],
          ] as const) {
            const x = Math.cos(a) * (r + w),
              z = Math.sin(a) * (r + w);
            pos.set(
              [
                x,
                groundHeight(
                  x,
                  z,
                  Math.max(0, Math.min(1, 1 - (Math.hypot(x, z) - 80) / 120)),
                ) +
                  ripple(r + w, t) +
                  0.35,
                z,
              ],
              s * 6 + off,
            );
          }
        }
        const idx: number[] = [];
        for (let s = 0; s < seg; s++)
          idx.push(
            s * 2,
            s * 2 + 1,
            s * 2 + 2,
            s * 2 + 1,
            s * 2 + 3,
            s * 2 + 2,
          );
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setIndex(idx);
        return (
          <mesh key={i} geometry={g}>
            <meshBasicMaterial
              color="#ffe6b0"
              transparent
              opacity={0.55 * o}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </>
  );
};

// ejecta curtain + dust puffs, in slow motion
const EJ = 7000;
const ejecta = (() => {
  const r = rng(31);
  return Array.from({ length: EJ }, () => {
    const az = r() * Math.PI * 2;
    const el = (28 + 40 * r()) * (Math.PI / 180);
    const v = 6 + 30 * Math.pow(r(), 1.6);
    return { az, el, v, b: 0.55 + 0.45 * r(), s: r() };
  });
})();
const Ejecta: React.FC<{
  t: number;
  scale: number;
  origin: THREE.Vector3;
  fade: number;
}> = ({ t, scale, origin, fade }) => {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(EJ * 3), 3),
    );
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(EJ * 3), 3),
    );
    return g;
  }, []);
  const pos = geom.attributes.position.array as Float32Array;
  const col = geom.attributes.color.array as Float32Array;
  const g = 2.2;
  ejecta.forEach((e, i) => {
    const h = e.v * Math.cos(e.el) * t * scale;
    const y = (e.v * Math.sin(e.el) * t - 0.5 * g * t * t) * scale;
    const x = Math.cos(e.az) * h,
      z = Math.sin(e.az) * h;
    pos.set(
      [origin.x + x, origin.y + Math.max(y, -0.5) + 0.3, origin.z + z],
      i * 3,
    );
    // lit from the sun side (+x): warm; shadow side: cool and dark
    const lit = 0.5 + 0.5 * Math.cos(e.az);
    const b = e.b * (0.35 + 0.65 * lit);
    col.set([b, b, b * 0.98], i * 3);
  });
  geom.attributes.position.needsUpdate = true;
  geom.attributes.color.needsUpdate = true;
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial
        map={getSoftSprite("dot")}
        size={0.32 * scale}
        sizeAttenuation
        vertexColors
        transparent
        opacity={fade}
        depthWrite={false}
      />
    </points>
  );
};

const PUFFS = (() => {
  const r = rng(57);
  return Array.from({ length: 70 }, () => {
    const up = r();
    return {
      az: r() * Math.PI * 2,
      out: 0.3 + up * 0.9 + 0.3 * r(),
      up: 0.05 + up * 1.3,
      s: 0.6 + 0.7 * r(),
      spin: r() * 6,
    };
  });
})();
const DustPuffs: React.FC<{
  t: number;
  origin: THREE.Vector3;
  scale: number;
  opacity: number;
}> = ({ t, origin, scale, opacity }) => (
  <>
    {PUFFS.map((p, i) => {
      const grow = 1 - Math.exp(-t * 1.6);
      const d = (CRATER_R * 0.8 + 22 * grow * p.out) * scale;
      const y = (1 + 16 * grow * p.up) * scale;
      const lit = 0.5 + 0.5 * Math.cos(p.az);
      const shade = Math.round(55 + 110 * lit);
      return (
        <sprite
          key={i}
          position={[
            origin.x + Math.cos(p.az) * d,
            origin.y + y,
            origin.z + Math.sin(p.az) * d,
          ]}
          scale={[
            (4 + 10 * grow) * p.s * scale,
            (4 + 10 * grow) * p.s * scale,
            1,
          ]}
        >
          <spriteMaterial
            map={getSoftSprite("puff")}
            color={`rgb(${shade + 10},${shade + 10},${shade + 10})`}
            transparent
            opacity={opacity * (0.75 - 0.35 * grow)}
            depthWrite={false}
            rotation={p.spin}
          />
        </sprite>
      );
    })}
  </>
);

// smoke rising slowly out of the fresh crater
const Smoke: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => (
  <>
    {Array.from({ length: 14 }, (_, i) => {
      const life = 70;
      const age = (frame - S[3] + i * (life / 14)) % life;
      const k = age / life;
      const r = rng(i * 13 + 5);
      const a = r() * Math.PI * 2;
      const x = Math.cos(a) * 4 * r() + k * 6,
        z = Math.sin(a) * 4 * r();
      return (
        <sprite
          key={i}
          position={[x, H0 - 1 + k * 22, z]}
          scale={[6 + 16 * k, 6 + 16 * k, 1]}
        >
          <spriteMaterial
            map={getSoftSprite("puff")}
            color="#9c9c9c"
            transparent
            opacity={opacity * Math.sin(Math.PI * k) * 0.35}
            depthWrite={false}
            rotation={i}
          />
        </sprite>
      );
    })}
  </>
);

// dark ejecta thrown out in rays around the new crater (decal draped on the terrain)
const RAYS_R = 60;
let raysTex: THREE.CanvasTexture | null = null;
const getRaysTex = () => {
  if (raysTex) return raysTex;
  const S2 = 1024;
  const cv = document.createElement("canvas");
  cv.width = S2;
  cv.height = S2;
  const g = cv.getContext("2d")!;
  const r = rng(404);
  const c = S2 / 2;
  const rimPx = (CRATER_R / RAYS_R) * c;
  // continuous dark blanket just outside the rim
  const gr = g.createRadialGradient(c, c, rimPx * 1.25, c, c, rimPx * 2.6);
  gr.addColorStop(0, "rgba(14,14,14,0.75)");
  gr.addColorStop(1, "rgba(20,20,20,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, S2, S2);
  // rays
  g.filter = "blur(7px)";
  for (let i = 0; i < 80; i++) {
    const a = r() * Math.PI * 2;
    const len = rimPx * (2 + 3.6 * r());
    const w = (0.015 + 0.04 * r()) * Math.PI;
    const lg = g.createRadialGradient(c, c, rimPx * 1.2, c, c, len);
    lg.addColorStop(0, `rgba(14,14,14,${0.25 + 0.3 * r()})`);
    lg.addColorStop(1, "rgba(18,18,18,0)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(c + Math.cos(a - w) * rimPx, c + Math.sin(a - w) * rimPx);
    g.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
    g.lineTo(c + Math.cos(a + w) * rimPx, c + Math.sin(a + w) * rimPx);
    g.closePath();
    g.fill();
  }
  g.filter = "none";
  // dark specks
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2,
      d = rimPx * (1.1 + 3.5 * r() ** 2),
      s = 1 + 3 * r();
    g.fillStyle = `rgba(15,15,15,${0.3 + 0.5 * r()})`;
    g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, s, s);
  }
  // keep the bowl itself clear (it is shaded by the geometry)
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.arc(c, c, rimPx * 1.2, 0, Math.PI * 2);
  g.fill();
  raysTex = new THREE.CanvasTexture(cv);
  raysTex.colorSpace = THREE.SRGBColorSpace;
  return raysTex;
};
const CraterRays: React.FC<{ c: number }> = ({ c }) => {
  const geom = useMemo(() => {
    const NR = 60,
      NA = 160;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= NR; i++)
      for (let j = 0; j <= NA; j++) {
        const rr = (i / NR) * RAYS_R,
          a = (j / NA) * Math.PI * 2;
        const x = Math.cos(a) * rr,
          z = Math.sin(a) * rr;
        pos.push(x, 0, z);
        uv.push(x / (2 * RAYS_R) + 0.5, 1 - (z / (2 * RAYS_R) + 0.5));
      }
    for (let i = 0; i < NR; i++)
      for (let j = 0; j < NA; j++) {
        const a = i * (NA + 1) + j,
          b = a + 1,
          d = a + NA + 1,
          e = d + 1;
        idx.push(a, b, d, b, e, d); // counter-clockwise seen from above (faces up)
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, []);
  const arr = geom.attributes.position.array as Float32Array;
  for (let k = 0; k < arr.length; k += 3) {
    const x = arr[k],
      z = arr[k + 2];
    arr[k + 1] = groundHeight(x, z) + newCrater(Math.hypot(x, z), c) + 0.15;
  }
  geom.attributes.position.needsUpdate = true;
  geom.computeVertexNormals();
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial
        map={getRaysTex()}
        transparent
        opacity={interpolate(c, [0.2, 1], [0, 1], clamp)}
        depthWrite={false}
        roughness={1}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
};

const SurfaceLights: React.FC = () => {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight("#fffaf4", 3.4);
    l.position.copy(SUN_GROUND.clone().multiplyScalar(300));
    l.castShadow = true;
    l.shadow.mapSize.set(4096, 4096);
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -140;
    c.right = 140;
    c.top = 140;
    c.bottom = -140;
    c.near = 10;
    c.far = 700;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.4;
    return l;
  }, []);
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
      {/* neutral fill so shadows read as grey ground, not black holes */}
      <ambientLight intensity={0.16} color="#b8bcc2" />
      <hemisphereLight args={["#6d727a", "#2e2e2e", 0.3]} />
    </>
  );
};

const SurfaceSet: React.FC<{ frame: number; pose: Pose; nasa: Nasa }> = ({
  frame,
  pose,
  nasa,
}) => {
  const sc = sceneOf(frame);
  const env = useEnv();
  const origin = V(0, H0, 0);
  let stage: React.ReactNode = null;
  let fx: React.ReactNode = null;
  if (sc === 3) {
    if (frame < IMPACT) {
      const p = DIVE_FROM.clone()
        .multiplyScalar(diveDist(frame) + 2)
        .add(origin);
      stage = (
        <group
          position={p}
          quaternion={yTo(DIVE_FROM.clone().multiplyScalar(-1), frame * 0.05)}
        >
          <RocketStage envMap={env} />
        </group>
      );
    }
    const t = slowT(frame, IMPACT);
    const dt = frame - IMPACT;
    if (dt >= 0) {
      fx = (
        <>
          {/* fireball flash at the impact point */}
          <Glow
            position={origin.clone().add(V(0, 3, 0))}
            size={20 + dt * 6}
            color="#fff1d6"
            opacity={Math.max(0, 1 - dt / 14)}
          />
          <Glow
            position={origin.clone().add(V(0, 2, 0))}
            size={60 + dt * 4}
            color="#ff9a40"
            opacity={0.7 * Math.max(0, 1 - dt / 26)}
          />
          <pointLight
            position={[0, H0 + 8, 0]}
            intensity={9000 * Math.exp(-dt / 4)}
            distance={200}
            decay={2}
            color="#ffd6a0"
          />
          <pointLight
            position={[0, H0 - 1.5, 0]}
            intensity={260 * Math.exp(-dt / 50)}
            distance={22}
            decay={2}
            color="#ff6a1a"
          />
          <Ejecta
            t={t}
            scale={1}
            origin={origin}
            fade={interpolate(t, [0, 0.03, 1.2, 1.8], [0, 1, 0.9, 0.5], clamp)}
          />
          <DustPuffs
            t={t}
            origin={origin}
            scale={1}
            opacity={
              interpolate(t, [0, 0.02, 1.6], [0, 0.9, 0.55], clamp) *
              interpolate(frame, [CUT4, CUT4 + 30], [1, 0.12], clamp)
            }
          />
          <Smoke
            frame={frame}
            opacity={interpolate(
              frame,
              [IMPACT + 30, CUT4, CUT4 + 40],
              [0, 0.8, 0.45],
              clamp,
            )}
          />
          <CraterRays c={craterAt(frame)} />
        </>
      );
    }
  } else {
    if (frame < IMPACT5) {
      const p = STAGE5_FROM.clone()
        .multiplyScalar(stage5Dist(frame) + 4)
        .add(origin);
      stage = (
        <group
          position={p}
          quaternion={yTo(
            V(-0.25, -1, 0.15),
            0.6 + (frame - S[4]) * 0.01,
          ).multiply(
            new THREE.Quaternion().setFromAxisAngle(
              V(1, 0, 0),
              0.3 + (frame - S[4]) * 0.004,
            ),
          )}
        >
          <RocketStage variant="apollo" envMap={env} />
        </group>
      );
    }
    const dt = frame - IMPACT5;
    if (dt >= 0) {
      const t = slowT(frame, IMPACT5) * 1.3;
      fx = (
        <>
          <Glow
            position={origin.clone().add(V(0, 3, 0))}
            size={30 + dt * 5}
            color="#fff1d6"
            opacity={Math.max(0, 1 - dt / 10)}
          />
          <pointLight
            position={[0, H0 + 8, 0]}
            intensity={6000 * Math.exp(-dt / 4)}
            distance={200}
            decay={2}
            color="#ffd6a0"
          />
          <Ejecta
            t={t}
            scale={0.6}
            origin={origin}
            fade={interpolate(
              t,
              [0, 0.03, 1.2, 2.4],
              [0, 0.9, 0.7, 0.2],
              clamp,
            )}
          />
          <DustPuffs
            t={t}
            origin={origin}
            scale={0.6}
            opacity={interpolate(t, [0, 0.02, 2.5], [0, 0.85, 0.3], clamp)}
          />
          <RippleRings frame={frame} />
        </>
      );
    }
  }
  return (
    <>
      <SurfaceLights />
      <Stars center={pose.p} />
      {/* Earth hanging low in the black sky */}
      {/* NASA Blue Marble with clouds, lit by the same sun (night side in shadow) */}
      <group
        position={pose.p
          .clone()
          .add(V(-0.5, 0.22, -0.84).normalize().multiplyScalar(2000))}
      >
        <mesh rotation={[0.2, -1.03, 0.4]}>
          <sphereGeometry args={[62, 96, 48]} />
          <meshStandardMaterial
            map={nasa.earth}
            roughness={0.85}
            metalness={0}
          />
        </mesh>
      </group>
      <Ground frame={frame} />
      {stage}
      {fx}
    </>
  );
};

// ---------------------------------------------------------------------------
export const FogueteScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const sc = sceneOf(frame);
  const pose = cameraPose(frame);
  const nasa = useNasaTextures();
  // mount the canvas only once the NASA textures are in memory: <ThreeCanvas> then holds the
  // frame (its own delayRender) until the scene with the real textures has been drawn
  if (!nasa) return null;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: 40, near: 0.5, far: 12000, position: [0, 0, 640] }}
      gl={{ antialias: true, toneMappingExposure: 1.05 }}
      shadows
      style={{ backgroundColor: "#000" }}
    >
      <color attach="background" args={["#000002"]} />
      <CameraRig pose={pose} />
      {nasa && (sc === 0 || sc === 5) && (
        <SpaceSet frame={frame} pose={pose} nasa={nasa} />
      )}
      {sc === 1 && <DriftSet frame={frame} pose={pose} />}
      {sc === 2 && <MapSet frame={frame} pose={pose} />}
      {nasa && (sc === 3 || sc === 4) && (
        <SurfaceSet frame={frame} pose={pose} nasa={nasa} />
      )}
    </ThreeCanvas>
  );
};

// exported for the overlays
export const ease3 = ease;
