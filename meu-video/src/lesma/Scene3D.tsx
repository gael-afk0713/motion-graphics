import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { getLesmaTextures, rng } from "./textures";
import { DURATION, FPS, S, SCENE_DURATIONS, sceneEnd } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.45, 0, 0.25, 1);

// ---------------------------------------------------------------------------
// Slug body: a leaf-shaped, flattened surface (local x = tail -> head)
// ---------------------------------------------------------------------------
const L = 4;
const WMAX = 1.15;
const leafW = (u: number) => {
  const ub = u / 0.88;
  if (ub <= 0 || ub >= 1) return 0;
  return WMAX * Math.pow(Math.sin(Math.PI * ub), 0.7) * (0.62 + 0.38 * ub);
};
const headW = (u: number) => {
  const d = (u - 0.9) / 0.1;
  return d * d < 1 ? 0.25 * Math.sqrt(1 - d * d) : 0;
};
const halfW = (u: number) => Math.max(leafW(u), headW(u));

export const bodyPoint = (u: number, v: number, t: number, out = new THREE.Vector3()) => {
  const w = halfW(u);
  const e = Math.abs(v);
  const leafness = Math.min(1, leafW(u) / 0.5);
  const thick = 0.13 * Math.sqrt(Math.max(0, 1 - v * v)) * Math.min(1, w / 0.25);
  const curl = 0.3 * e * e * leafness;
  const ripple = 0.11 * Math.pow(e, 1.5) * leafness * Math.sin(2 * Math.PI * 2.6 * u - t * 2.4 + (v > 0 ? 0 : 1.4));
  const wave = 0.05 * Math.sin(2 * Math.PI * 1.1 * u - t * 1.3);
  return out.set((u - 0.5) * L, thick + curl + ripple + wave, v * w);
};

const NU = 110;
const NV = 36;

const SlugBody: React.FC<{ t: number; glow: number }> = ({ t, glow }) => {
  const { map, emissive } = getLesmaTextures();
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3);
    const uv = new Float32Array((NU + 1) * (NV + 1) * 2);
    const idx: number[] = [];
    for (let i = 0; i <= NU; i++)
      for (let j = 0; j <= NV; j++) {
        const k = i * (NV + 1) + j;
        uv[k * 2] = i / NU;
        uv[k * 2 + 1] = 1 - j / NV;
        if (i < NU && j < NV) {
          const a = k, b = k + NV + 1, c = k + 1, d = k + NV + 2;
          idx.push(a, b, c, c, b, d);
        }
      }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, []);
  // frame-driven deformation (no useFrame)
  const p = geom.attributes.position as THREE.BufferAttribute;
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= NU; i++)
    for (let j = 0; j <= NV; j++) {
      bodyPoint(i / NU, (j / NV) * 2 - 1, t, tmp);
      p.setXYZ(i * (NV + 1) + j, tmp.x, tmp.y, tmp.z);
    }
  p.needsUpdate = true;
  geom.computeVertexNormals();
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        map={map}
        emissiveMap={emissive}
        emissive="#c9ff6e"
        emissiveIntensity={glow}
        roughness={0.5}
        metalness={0.05}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const Rhinophores: React.FC<{ t: number }> = ({ t }) => {
  return (
    <>
      {[-1, 1].map((side) => {
        const base = bodyPoint(0.965, side * 0.55, t);
        const wig = 0.12 * Math.sin(t * 2.2 + side);
        return (
          <mesh key={side} position={[base.x, base.y + 0.12, base.z]} rotation={[side * (0.4 + wig), 0, -0.75 + wig * 0.5]}>
            <coneGeometry args={[0.055, 0.42, 14]} />
            <meshStandardMaterial color="#25b862" emissive="#0c4d27" emissiveIntensity={0.4} roughness={0.5} />
          </mesh>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Algae filament + chloroplasts travelling into the slug's channels
// ---------------------------------------------------------------------------
const filamentCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(1.96, 0.14, 0),
  new THREE.Vector3(2.6, 0.38, -0.1),
  new THREE.Vector3(3.1, 0.95, 0.12),
  new THREE.Vector3(3.4, 1.75, -0.15),
  new THREE.Vector3(3.5, 2.9, 0.05),
]);

const Filament: React.FC<{ frame: number }> = ({ frame }) => {
  const geom = useMemo(() => new THREE.TubeGeometry(filamentCurve, 80, 0.07, 12), []);
  const op = interpolate(frame, [S[1] - 4, S[1] + 6, sceneEnd(2) - 8, sceneEnd(2) + 6], [0, 1, 1, 0], clamp);
  if (op <= 0) return null;
  const drained = interpolate(frame, [S[1] + 20, sceneEnd(2) - 10], [0, 1], clamp);
  const col = new THREE.Color("#35c766").lerp(new THREE.Color("#a9d8b8"), drained);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color={col} transparent opacity={op * (0.95 - drained * 0.35)} roughness={0.4} emissive="#0d3d1d" emissiveIntensity={0.3} />
    </mesh>
  );
};

const N_CHL = 46;
const chlPlan = (() => {
  const r = rng(11);
  const branchU: number[] = [];
  for (let u = 0.1; u <= 0.8; u += 0.075) branchU.push(u);
  const launchFrom = S[1] + 14, launchTo = S[2] + 72;
  return Array.from({ length: N_CHL }, (_, j) => {
    const bu = branchU[Math.floor(r() * branchU.length)];
    const side = r() < 0.5 ? -1 : 1;
    const s = 0.12 + r() * 0.75;
    const onMid = r() < 0.18;
    return {
      a0: 0.25 + r() * 0.7, // start position along the filament
      launch: launchFrom + ((launchTo - launchFrom) * j) / (N_CHL - 1) + r() * 4,
      u: onMid ? 0.1 + r() * 0.7 : bu + 0.075 * s,
      v: onMid ? 0 : side * (0.04 + 0.86 * s),
      rot: r() * Math.PI,
    };
  });
})();

const Chloroplasts: React.FC<{ frame: number; t: number; glow: number }> = ({ frame, t, glow }) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshStandardMaterial({ color: "#5dff8a", emissive: "#1fcf55", roughness: 0.35 }),
      N_CHL,
    );
    m.frustumCulled = false;
    return m;
  }, []);
  (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + glow * 0.9;
  const visible = frame >= S[1] - 2 && (frame < S[5] || frame >= S[6]);
  const dummy = new THREE.Object3D();
  const p = new THREE.Vector3();
  chlPlan.forEach((c, j) => {
    const k1 = interpolate(frame, [c.launch, c.launch + 36], [0, 1], { ...clamp, easing: ease });
    const k2 = interpolate(frame, [c.launch + 36, c.launch + 80], [0, 1], { ...clamp, easing: ease });
    if (k2 <= 0) {
      p.copy(filamentCurve.getPoint(c.a0 * (1 - k1)));
    } else {
      const u = 0.98 + (c.u - 0.98) * Math.min(1, k2 * 1.6);
      const v = c.v * Math.max(0, (k2 - 0.4) / 0.6);
      bodyPoint(u, v, t, p);
      p.y += 0.05;
    }
    dummy.position.copy(p);
    dummy.rotation.set(0, c.rot, 0);
    const sc = k2 > 0 && k2 < 1 ? 1.1 : 1;
    dummy.scale.set(0.075 * sc, 0.042, 0.042);
    dummy.updateMatrix();
    mesh.setMatrixAt(j, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (!visible) return null;
  return <primitive object={mesh} />;
};

// ---------------------------------------------------------------------------
// Ocean: gradient sky-sphere, sun rays from above, drifting particles
// ---------------------------------------------------------------------------
const OceanBackground: React.FC = () => {
  const camera = useThree((s) => s.camera);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color("#46b8ee") }, mid: { value: new THREE.Color("#0d5a8f") }, bottom: { value: new THREE.Color("#04203a") } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vDir;
          void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.85, h)) : mix(mid, bottom, smoothstep(0.0, 0.7, -h)); gl_FragColor = vec4(c, 1.0);} `,
      }),
    [],
  );
  return (
    <mesh position={camera.position.clone()} material={mat} renderOrder={-1}>
      <sphereGeometry args={[80, 32, 24]} />
    </mesh>
  );
};

const RAYS = (() => {
  const r = rng(5);
  return Array.from({ length: 9 }, () => ({
    x: -5 + r() * 10,
    z: -6 + r() * 9,
    w: 0.6 + r() * 1.4,
    ph: r() * 6,
  }));
})();

const SunRays: React.FC<{ frame: number; boost: number; topY: number }> = ({ frame, boost, topY }) => {
  const { ray } = getLesmaTextures();
  const camera = useThree((s) => s.camera);
  return (
    <>
      {RAYS.map((rr, i) => {
        const op = (0.12 + 0.05 * Math.sin(frame * 0.05 + rr.ph)) * boost;
        const ang = Math.atan2(camera.position.x - rr.x, camera.position.z - rr.z);
        return (
          <mesh key={i} position={[rr.x, topY - 12, rr.z]} rotation={[0, ang, 0.22]}>
            <planeGeometry args={[rr.w, 26]} />
            <meshBasicMaterial map={ray} transparent opacity={op} blending={THREE.AdditiveBlending} depthWrite={false} color="#cfeeff" side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </>
  );
};

const Particles: React.FC<{ frame: number; yOff: number }> = ({ frame, yOff }) => {
  const { dot } = getLesmaTextures();
  const geom = useMemo(() => {
    const r = rng(21);
    const n = 600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([-9 + r() * 18, -4 + r() * 16, -10 + r() * 16], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geom} position={[Math.sin(frame * 0.01) * 0.3, yOff + ((frame * 0.004) % 2), 0]}>
      <pointsMaterial map={dot} size={0.07} transparent opacity={0.55} depthWrite={false} color="#cdeeff" blending={THREE.AdditiveBlending} />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Scene 6: inside view — a big chloroplast (separate "micro" set)
// ---------------------------------------------------------------------------
const MICRO_Y = -40;
const BigChloroplast: React.FC<{ frame: number }> = ({ frame }) => {
  const stacks = useMemo(() => [-1.45, -0.95, -0.45, 0.05, 0.55, 1.05, 1.5], []);
  const t = (frame - S[5]) / FPS;
  return (
    <group position={[0, MICRO_Y, 0]} rotation={[0.25 + t * 0.05, t * 0.18 - 0.4, 0.15]}>
      <mesh scale={[2.4, 1.3, 1.3]}>
        <sphereGeometry args={[1, 64, 40]} />
        <meshStandardMaterial color="#47d873" transparent opacity={0.38} emissive="#1d7a3c" emissiveIntensity={0.35} side={THREE.DoubleSide} depthWrite={false} roughness={0.3} />
      </mesh>
      <mesh scale={[2.25, 1.17, 1.17]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color="#1f9a49" transparent opacity={0.22} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {stacks.map((x, i) => (
        <group key={i} position={[x, Math.sin(i * 1.7) * 0.2, Math.cos(i * 2.1) * 0.15]} rotation={[0, 0, Math.sin(i) * 0.2]}>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[0, (k - 2) * 0.11, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.07, 28]} />
              <meshStandardMaterial color="#1c8f3f" emissive="#22ff66" emissiveIntensity={0.18 + 0.12 * Math.sin(frame * 0.15 + i)} roughness={0.45} />
            </mesh>
          ))}
          {i < stacks.length - 1 && (
            <mesh position={[0.25, 0.02, 0]}>
              <boxGeometry args={[0.5, 0.025, 0.12]} />
              <meshStandardMaterial color="#3ccf6a" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Scene 7: water surface seen from below
// ---------------------------------------------------------------------------
const SURFACE_Y = 7.4;
const Surface: React.FC<{ frame: number }> = ({ frame }) => {
  const { dot } = getLesmaTextures();
  return (
    <group>
      <mesh position={[0, SURFACE_Y, 0]} rotation={[Math.PI / 2, 0, frame * 0.002]}>
        <planeGeometry args={[80, 80, 1, 1]} />
        <meshBasicMaterial color="#8fe3ff" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <sprite position={[2.5, SURFACE_Y + 2, -6]} scale={[9, 9, 1]}>
        <spriteMaterial map={dot} color="#fff6d0" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Camera: one shot per scene, quick smooth blend at each cut
// ---------------------------------------------------------------------------
type V3 = [number, number, number];
type Pose = { p: V3; t: V3 };
const SHOTS: { a: Pose; b: Pose }[] = [
  { a: { p: [2.1, 1.35, 0.6], t: [0, 0.6, -1.5] }, b: { p: [1.7, 1.1, 0.0], t: [0, 0.55, -1.65] } }, // 1 close-up
  { a: { p: [5.4, 1.35, -2.25], t: [0, 1.0, -2.3] }, b: { p: [4.9, 1.3, -2.4], t: [0, 0.98, -2.4] } }, // 2 sucking algae
  { a: { p: [0.2, 6.4, 2.6], t: [0, 0.2, -0.9] }, b: { p: [0.1, 5.8, 2.1], t: [0, 0.2, -0.9] } }, // 3 channels
  { a: { p: [2.6, 4.6, 3.6], t: [0, 0.3, -0.3] }, b: { p: [1.9, 4.9, 3.1], t: [0, 0.35, -0.3] } }, // 4 solar
  { a: { p: [-3.2, 3.4, 3.6], t: [0, 0.6, 0] }, b: { p: [-2.4, 3.8, 4.3], t: [0, 0.6, 0] } }, // 5 counter
  { a: { p: [0, MICRO_Y + 0.6, 12], t: [0, MICRO_Y, 0] }, b: { p: [0.35, MICRO_Y + 0.3, 5.4], t: [0, MICRO_Y, 0] } }, // 6 zoom
  { a: { p: [2.7, 3.6, 3.6], t: [0, 6.1, -0.4] }, b: { p: [2.2, 3.9, 2.9], t: [0, 6.2, -0.4] } }, // 7 surface
];
const BLEND = 12;
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export const sceneOf = (f: number) => {
  for (let i = S.length - 1; i >= 0; i--) if (f >= S[i]) return i;
  return 0;
};

const cameraPose = (f: number): Pose => {
  const i = sceneOf(f);
  const local = f - S[i];
  let k = Math.min(1, local / (SCENE_DURATIONS[i] - 1));
  if (i === 5) {
    // fast dive in, then slow drift
    k = local < 26 ? 0.82 * Easing.out(Easing.cubic)(local / 26) : 0.82 + 0.18 * ((local - 26) / (SCENE_DURATIONS[i] - 26));
  } else k = ease(k);
  let pose: Pose = { p: lerp3(SHOTS[i].a.p, SHOTS[i].b.p, k), t: lerp3(SHOTS[i].a.t, SHOTS[i].b.t, k) };
  if (i >= 1 && i <= 4 && local < BLEND) {
    const m = ease(local / BLEND);
    const prev = SHOTS[i - 1].b;
    pose = { p: lerp3(prev.p, pose.p, m), t: lerp3(prev.t, pose.t, m) };
  }
  return pose;
};

const CameraRig: React.FC<{ frame: number }> = ({ frame }) => {
  const camera = useThree((s) => s.camera);
  const { p, t } = cameraPose(frame);
  camera.position.set(...p);
  camera.lookAt(new THREE.Vector3(...t));
  camera.updateMatrixWorld();
  return null;
};

// ---------------------------------------------------------------------------
export const LesmaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / FPS;
  const scene = sceneOf(frame);

  // body glow: solar-panel moment in scene 4, softer afterwards
  const glow =
    interpolate(frame, [S[3] + 4, S[3] + 34, sceneEnd(3) - 6, sceneEnd(3) + 6], [0, 1, 1, 0.35], clamp) *
      (1 + 0.15 * Math.sin(frame * 0.25)) +
    interpolate(frame, [S[6], S[6] + 20], [0, 0.5], clamp);
  const rayBoost =
    1 +
    interpolate(frame, [S[3], S[3] + 20, sceneEnd(3) - 5, sceneEnd(3) + 5], [0, 1.8, 1.8, 0], clamp) +
    (scene === 6 ? 1.6 : 0);
  const slugY = scene === 6 ? 6.0 : 0;
  const showSlug = scene !== 5;

  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 40, near: 0.05, far: 200, position: [3, 2, 3] }} gl={{ antialias: true }}>
      <CameraRig frame={frame} />
      <OceanBackground />
      <fog attach="fog" args={["#0b4a78", 10, 38]} />
      <ambientLight intensity={0.55} color="#5fa6d6" />
      <hemisphereLight args={["#9fe0ff", "#062033", 0.7]} />
      <directionalLight position={[2.5, 12, 2]} intensity={2.2 + glow * 0.8} color="#fff4d6" />
      {scene !== 5 && <SunRays frame={frame} boost={rayBoost} topY={scene === 6 ? SURFACE_Y : 12} />}
      <Particles frame={frame} yOff={scene === 5 ? MICRO_Y : 0} />
      {showSlug && (
        <group position={[0, slugY, 0]} rotation={[scene === 6 ? -0.12 : 0, Math.PI / 2, 0]}>
          <SlugBody t={t} glow={0.12 + glow * 2.4} />
          {glow > 0.02 && (
            <sprite position={[0, -0.1, 0]} scale={[6.5, 4.2, 1]}>
              <spriteMaterial map={getLesmaTextures().dot} color="#d8ff7a" transparent opacity={0.5 * Math.min(1, glow)} blending={THREE.AdditiveBlending} depthWrite={false} />
            </sprite>
          )}
          <Rhinophores t={t} />
          <Filament frame={frame} />
          <Chloroplasts frame={frame} t={t} glow={glow} />
        </group>
      )}
      {scene === 5 && <BigChloroplast frame={frame} />}
      {scene === 6 && <Surface frame={frame} />}
    </ThreeCanvas>
  );
};

export { DURATION };
