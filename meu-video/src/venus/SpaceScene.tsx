import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { getTextures, mulberry32 } from "./textures";
import {
  approachDirection,
  CUT,
  ORBIT,
  ORBIT_RADIUS,
  orbitProgress,
  venusPosition,
  VENUS_RADIUS,
  venusSpin,
  cameraState,
} from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const CameraRig: React.FC<{ frame: number }> = ({ frame }) => {
  const camera = useThree((s) => s.camera);
  const { pos, target } = cameraState(frame);
  camera.position.copy(pos);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  useLayoutEffect(() => {
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  });
  return null;
};

const Stars: React.FC = () => {
  const layers = useMemo(() => {
    const make = (count: number, seed: number, rMin: number, rMax: number) => {
      const rnd = mulberry32(seed);
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const u = rnd() * 2 - 1;
        const phi = rnd() * Math.PI * 2;
        const r = rMin + rnd() * (rMax - rMin);
        const s = Math.sqrt(1 - u * u);
        pos.set([r * s * Math.cos(phi), r * u, r * s * Math.sin(phi)], i * 3);
        const tint = rnd();
        const b = 0.55 + rnd() * 0.45;
        col.set(
          tint < 0.2 ? [b, b * 0.85, b * 0.7] : tint > 0.8 ? [b * 0.8, b * 0.9, b] : [b, b, b],
          i * 3,
        );
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      return g;
    };
    return [make(5000, 7, 900, 1400), make(900, 21, 900, 1400)];
  }, []);
  return (
    <>
      <points geometry={layers[0]}>
        <pointsMaterial size={2.2} sizeAttenuation={false} vertexColors toneMapped={false} />
      </points>
      <points geometry={layers[1]}>
        <pointsMaterial size={4} sizeAttenuation={false} vertexColors toneMapped={false} />
      </points>
    </>
  );
};

// Dust close to the fly-in path -> strong parallax gives the feeling of speed
const SpeedDust: React.FC<{ frame: number }> = ({ frame }) => {
  const geom = useMemo(() => {
    const rnd = mulberry32(99);
    const V = venusPosition(0);
    const d = approachDirection(0);
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(d, up).normalize();
    const up2 = new THREE.Vector3().crossVectors(side, d).normalize();
    const count = 1400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = 25 + rnd() * 330;
      const a = rnd() * Math.PI * 2;
      const r = 3 + rnd() * 26;
      const p = V.clone()
        .add(d.clone().multiplyScalar(u))
        .add(side.clone().multiplyScalar(Math.cos(a) * r))
        .add(up2.clone().multiplyScalar(Math.sin(a) * r));
      pos.set([p.x, p.y, p.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const opacity = interpolate(frame, [0, 40, 60], [1, 0.8, 0], clamp);
  if (opacity <= 0) return null;
  return (
    <points geometry={geom}>
      <pointsMaterial
        size={0.35}
        color="#dfe8ff"
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
};

const atmosphereVertex = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 color;
  uniform float strength;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    float edge = clamp(-vViewNormal.z * 1.9, 0.0, 1.0);
    float i = pow(edge, 2.2);
    float lit = 0.25 + 0.75 * smoothstep(-0.35, 0.6, dot(vWorldNormal, sunDir));
    gl_FragColor = vec4(color * i * lit * strength, 1.0);
  }
`;

const rimFragment = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 color;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    float f = pow(1.0 - clamp(vViewNormal.z, 0.0, 1.0), 2.6);
    float lit = smoothstep(-0.25, 0.5, dot(vWorldNormal, sunDir));
    gl_FragColor = vec4(color * f * lit * 1.3, 1.0);
  }
`;

const Venus: React.FC<{ frame: number }> = ({ frame }) => {
  const { surface, clouds } = getTextures();
  const V = venusPosition(frame);
  const sunDir = V.clone().multiplyScalar(-1).normalize();
  const spin = venusSpin(frame);

  const halo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: haloFragment,
        uniforms: {
          sunDir: { value: new THREE.Vector3() },
          color: { value: new THREE.Color("#ffb04a") },
          strength: { value: 1.1 },
        },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  const rim = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: rimFragment,
        uniforms: {
          sunDir: { value: new THREE.Vector3() },
          color: { value: new THREE.Color("#ffd27a") },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  halo.uniforms.sunDir.value.copy(sunDir);
  rim.uniforms.sunDir.value.copy(sunDir);

  return (
    <group position={V}>
      <group rotation={[0, 0, (-177.4 + 180) * (Math.PI / 180)]}>
        <mesh rotation={[0, spin, 0]}>
          <sphereGeometry args={[VENUS_RADIUS, 128, 96]} />
          <meshStandardMaterial map={surface} roughness={1} metalness={0} />
        </mesh>
        <mesh rotation={[0, spin * 1.6 + 0.8, 0]}>
          <sphereGeometry args={[VENUS_RADIUS * 1.012, 128, 96]} />
          <meshStandardMaterial
            map={clouds}
            transparent
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        </mesh>
      </group>
      <mesh material={rim}>
        <sphereGeometry args={[VENUS_RADIUS * 1.02, 96, 64]} />
      </mesh>
      <mesh material={halo}>
        <sphereGeometry args={[VENUS_RADIUS * 1.28, 96, 64]} />
      </mesh>
    </group>
  );
};

const Sun: React.FC = () => {
  const { glow } = getTextures();
  return (
    <group>
      <mesh>
        <sphereGeometry args={[4.5, 64, 48]} />
        <meshBasicMaterial color="#fff4cf" toneMapped={false} />
      </mesh>
      <sprite scale={[26, 26, 1]}>
        <spriteMaterial
          map={glow}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          toneMapped={false}
        />
      </sprite>
      <sprite scale={[70, 70, 1]}>
        <spriteMaterial
          map={glow}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.45}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
};

const OrbitPath: React.FC<{ frame: number }> = ({ frame }) => {
  const { full, trail } = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 256;
    for (let i = 0; i <= N; i++) {
      const th = 0.9 + (i / N) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(ORBIT_RADIUS * Math.cos(th), 0, -ORBIT_RADIUS * Math.sin(th)),
      );
    }
    const g1 = new THREE.BufferGeometry().setFromPoints(pts);
    const g2 = new THREE.BufferGeometry().setFromPoints(pts);
    const m1 = new THREE.LineBasicMaterial({
      color: "#ffffff",
      transparent: true,
      depthWrite: false,
    });
    const m2 = new THREE.LineBasicMaterial({
      color: "#ffd23f",
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { full: new THREE.Line(g1, m1), trail: new THREE.Line(g2, m2) };
  }, []);

  const op = interpolate(
    frame,
    [CUT.spinEnd + 15, CUT.spinEnd + 40, CUT.compareEnd - 6, CUT.compareEnd + 4],
    [0, 1, 1, 0],
    clamp,
  );
  (full.material as THREE.LineBasicMaterial).opacity = 0.22 * op;
  (trail.material as THREE.LineBasicMaterial).opacity = op;
  const p = frame >= ORBIT.end ? 1 : orbitProgress(frame);
  trail.geometry.setDrawRange(0, Math.max(0, Math.round(p * 256) + 1));
  if (op <= 0) return null;
  return (
    <>
      <primitive object={full} />
      <primitive object={trail} />
    </>
  );
};

// Curved arrow around Venus' equator, pointing clockwise (retrograde)
const RetroArrow: React.FC<{ frame: number }> = ({ frame }) => {
  const start = CUT.compareEnd + 8;
  const grow = interpolate(frame, [start, start + 22], [0.05, 1], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const op = interpolate(
    frame,
    [start - 2, start + 4, CUT.retroEnd - 2, CUT.retroEnd + 8],
    [0, 1, 1, 0],
    clamp,
  );
  const geom = useMemo(() => new Map<number, THREE.TorusGeometry>(), []);
  if (op <= 0) return null;
  const arc = Math.round(grow * 1.55 * Math.PI * 100) / 100;
  let g = geom.get(arc);
  if (!g) {
    g = new THREE.TorusGeometry(VENUS_RADIUS * 1.32, 0.16, 12, 160, arc);
    geom.set(arc, g);
  }
  const V = venusPosition(frame);
  const rot = -(frame - start) * 0.05 + 1.2;
  const r = VENUS_RADIUS * 1.32;
  return (
    <group position={V} rotation={[0, rot, 0]}>
      <mesh geometry={g} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#ffd23f" transparent opacity={op} toneMapped={false} />
      </mesh>
      <mesh position={[r, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.6, 1.4, 24]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={op} toneMapped={false} />
      </mesh>
    </group>
  );
};

export const SpaceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: 45, near: 0.1, far: 4000, position: [0, 0, 300] }}
      gl={{ antialias: true }}
      style={{ backgroundColor: "#03030a" }}
    >
      <color attach="background" args={["#020208"]} />
      <CameraRig frame={frame} />
      <ambientLight intensity={0.05} color="#8899ff" />
      <pointLight position={[0, 0, 0]} intensity={3.2} decay={0} color="#fff1d6" />
      <Stars />
      <SpeedDust frame={frame} />
      <Sun />
      <OrbitPath frame={frame} />
      <Venus frame={frame} />
      <RetroArrow frame={frame} />
    </ThreeCanvas>
  );
};
