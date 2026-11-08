import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { getLesmaTextures, rng } from "../lesma/textures";
import { CERATA, makeSSS, Sheep } from "./Sheep";
import { FPS, S, SCENE_DURATIONS, sceneEnd, sceneOf } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.45, 0, 0.25, 1);
const WATER = "#1f6b78";

// ---------------------------------------------------------------------------
// Camera: one floating shot per scene; smooth blends, dips on set changes
// ---------------------------------------------------------------------------
type V3 = [number, number, number];
type Pose = { p: V3; t: V3 };
const SHOTS: { a: Pose; b: Pose }[] = [
  { a: { p: [0, 0.95, 6.4], t: [0, 0.62, 0] }, b: { p: [0.25, 0.9, 5.8], t: [0, 0.6, 0] } }, // 1 front close-up
  { a: { p: [0, 0.7, 4.6], t: [0, 0.5, 0.9] }, b: { p: [0, 0.36, 1.95], t: [0, 0.33, 1.1] } }, // 2 into the eyes
  { a: { p: [0.6, 0.75, 3.8], t: [0.4, 0.4, 0.3] }, b: { p: [0.95, 2.3, 10.6], t: [0.85, 0.4, 0.3] } }, // 3 rice grain
  { a: { p: [2.9, 1.0, 3.6], t: [0.1, 0.35, 0.9] }, b: { p: [2.5, 0.85, 3.1], t: [0.1, 0.3, 1.0] } }, // 4 nibbling
  { a: { p: [-1.6, 0.55, 4.6], t: [0, 0.7, 0] }, b: { p: [-1.0, 0.75, 4.0], t: [0, 0.75, 0] } }, // 5 backlit leaves
  { a: { p: [0, 0.95, 6.0], t: [0, 0.6, 0] }, b: { p: [0, 0.85, 5.2], t: [0, 0.55, 0] } }, // 6 fading
  { a: { p: [0.3, 0.95, 6.2], t: [0, 0.62, 0] }, b: { p: [-0.2, 0.9, 5.7], t: [0, 0.62, 0] } }, // 7 happy
];
const BLEND = 12;
const BLEND_INTO = new Set([1, 4, 5, 6]); // scenes 3 and 4 change set -> quick dip instead
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export const cameraPose = (f: number): Pose => {
  const i = sceneOf(f);
  const local = f - S[i];
  const k = i === 1 ? Easing.bezier(0.5, 0, 0.3, 1)(Math.min(1, local / (SCENE_DURATIONS[i] - 1))) : ease(Math.min(1, local / (SCENE_DURATIONS[i] - 1)));
  let pose: Pose = { p: lerp3(SHOTS[i].a.p, SHOTS[i].b.p, k), t: lerp3(SHOTS[i].a.t, SHOTS[i].b.t, k) };
  if (BLEND_INTO.has(i) && local < BLEND) {
    const m = ease(local / BLEND);
    const prev = SHOTS[i - 1].b;
    pose = { p: lerp3(prev.p, pose.p, m), t: lerp3(prev.t, pose.t, m) };
  }
  // diver-like floating sway (smaller in the extreme eye close-up)
  const t = f / FPS;
  const amp = i === 1 ? 0.25 + 0.75 * (1 - k) : 1;
  const sway: V3 = [0.06 * Math.sin(t * 0.6) * amp, 0.045 * Math.sin(t * 0.83 + 1) * amp, 0.05 * Math.sin(t * 0.5 + 2) * amp];
  return { p: [pose.p[0] + sway[0], pose.p[1] + sway[1], pose.p[2] + sway[2]], t: [pose.t[0] + sway[0] * 0.4, pose.t[1] + sway[1] * 0.4, pose.t[2]] };
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
// Shared scene state (frame -> look)
// ---------------------------------------------------------------------------
const lightDirFor = (f: number) => {
  const k = interpolate(f, [S[4] - 6, S[4] + 14, sceneEnd(4) - 10, sceneEnd(4) + 8], [0, 1, 1, 0], clamp);
  return new THREE.Vector3(-0.45, 0.95, 0.55).lerp(new THREE.Vector3(0.15, 0.8, -0.6), k).normalize();
};
const isSandSet = (f: number) => sceneOf(f) === 2;

// ---------------------------------------------------------------------------
// Environment (background layer, rendered blurred = shallow depth of field)
// ---------------------------------------------------------------------------
const WaterBackground: React.FC = () => {
  const camera = useThree((s) => s.camera);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#7cc6cf") },
          mid: { value: new THREE.Color("#2a7f8c") },
          bottom: { value: new THREE.Color("#3f6f62") },
        },
        vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vD;
          void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.8, h)) : mix(mid, bottom, smoothstep(0.0, 0.5, -h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh position={camera.position.clone()} material={mat} renderOrder={-1}>
      <sphereGeometry args={[90, 32, 24]} />
    </mesh>
  );
};

const causticsFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uSand; uniform vec3 uWater; uniform float uRadius; uniform vec3 uCenter;
  varying vec3 vWP;
  void main(){
    vec2 uv = vWP.xz * 0.55;
    float t = uTime * 0.7;
    for (int n = 0; n < 4; n++) {
      float fn = float(n);
      uv += vec2(sin(uv.y * 2.1 + t + fn * 1.3), cos(uv.x * 1.9 - t * 0.8 + fn)) * 0.28;
    }
    float c = pow(0.5 + 0.5 * sin(uv.x * 5.5) * sin(uv.y * 5.5), 7.0);
    vec3 col = uSand * (0.82 + 0.18 * sin(vWP.x * 7.0 + vWP.z * 5.0) * sin(vWP.z * 9.0));
    col += c * vec3(1.0, 0.97, 0.82) * 0.55;
    float d = length(cameraPosition - vWP);
    col = mix(col, uWater, smoothstep(6.0, 26.0, d) * 0.85);
    float a = 1.0;
    if (uRadius > 0.0) a = 1.0 - smoothstep(uRadius * 0.55, uRadius, length(vWP.xz - uCenter.xz));
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;
const sandVert = `varying vec3 vWP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vWP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;

const makeSand = (radius: number) =>
  new THREE.ShaderMaterial({
    vertexShader: sandVert,
    fragmentShader: causticsFrag,
    transparent: radius > 0,
    depthWrite: radius <= 0,
    uniforms: {
      uTime: { value: 0 },
      uSand: { value: new THREE.Color("#e1d6b4") },
      uWater: { value: new THREE.Color(WATER) },
      uRadius: { value: radius },
      uCenter: { value: new THREE.Vector3(0.8, 0, 0.2) },
    },
  });

const SandFloor: React.FC<{ frame: number; y: number; radius?: number; size?: number }> = ({ frame, y, radius = 0, size = 140 }) => {
  const mat = useMemo(() => makeSand(radius), [radius]);
  mat.uniforms.uTime.value = frame / FPS;
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <planeGeometry args={[size, size, 1, 1]} />
    </mesh>
  );
};

// Avrainvillea: broad, fan-shaped, dark olive, velvety blades on short stalks
const fanGeometry = (R: number, spread: number, seed: number) => {
  const r = rng(seed);
  const sh = new THREE.Shape();
  const a0 = Math.PI / 2 - spread / 2, a1 = Math.PI / 2 + spread / 2;
  sh.moveTo(0, 0);
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const rr = R * (0.88 + 0.08 * Math.sin(i * 1.7 + seed) + 0.05 * r());
    sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  sh.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(sh, 6);
  // gentle wave so it is not perfectly flat
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, 0.12 * Math.sin(x * 1.3 + seed) * (y / R) + 0.08 * Math.sin(y * 2.1));
  }
  g.computeVertexNormals();
  return g;
};

let velvetTex: THREE.CanvasTexture | null = null;
const getVelvetTex = () => {
  if (velvetTex) return velvetTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b8b8b8";
  g.fillRect(0, 0, 256, 256);
  const r = rng(99);
  for (let i = 0; i < 2600; i++) {
    const x = r() * 256, y = r() * 256, l = 4 + r() * 10, v = 150 + r() * 105;
    g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 3, y + l);
    g.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const x = r() * 256, y = r() * 256, rad = 8 + r() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(80,80,80,${0.12 + r() * 0.12})`);
    gr.addColorStop(1, "rgba(80,80,80,0)");
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  velvetTex = new THREE.CanvasTexture(c);
  velvetTex.wrapS = velvetTex.wrapT = THREE.RepeatWrapping;
  velvetTex.colorSpace = THREE.SRGBColorSpace;
  return velvetTex;
};

const velvet = (color: string) =>
  new THREE.MeshPhysicalMaterial({
    map: getVelvetTex(),
    color,
    roughness: 1,
    sheen: 1,
    sheenColor: new THREE.Color("#a3ad6c"),
    sheenRoughness: 0.75,
    side: THREE.DoubleSide,
  });

const FANS = (() => {
  const r = rng(77);
  return Array.from({ length: 10 }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return {
      x: side * (1.6 + r() * 6.5),
      z: -2.5 - r() * 9,
      R: 2.4 + r() * 2.8,
      spread: 1.6 + r() * 0.5,
      rotY: side * (0.3 + r() * 0.5),
      tilt: -0.15 + r() * 0.25,
      color: ["#4b5a2a", "#56632f", "#46552a", "#5d6a35"][i % 4],
      seed: i * 3 + 1,
    };
  });
})();

const AlgaeFans: React.FC<{ frame: number; baseY: number }> = ({ frame, baseY }) => {
  const geos = useMemo(() => FANS.map((f) => fanGeometry(f.R, f.spread, f.seed)), []);
  const mats = useMemo(() => FANS.map((f) => velvet(f.color)), []);
  return (
    <>
      {FANS.map((f, i) => (
        <group key={i} position={[f.x, baseY, f.z]} rotation={[f.tilt + 0.03 * Math.sin(frame * 0.04 + i), f.rotY, 0.04 * Math.sin(frame * 0.03 + i)]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 0.7, 10]} />
            <meshStandardMaterial color="#3e4a22" roughness={1} />
          </mesh>
          <mesh geometry={geos[i]} material={mats[i]} position={[0, 0.65, 0]} />
        </group>
      ))}
    </>
  );
};

const RAYS = (() => {
  const r = rng(9);
  return Array.from({ length: 8 }, () => ({ x: -6 + r() * 12, z: -10 + r() * 8, w: 0.8 + r() * 1.6, ph: r() * 6 }));
})();
const SunRays: React.FC<{ frame: number; boost: number }> = ({ frame, boost }) => {
  const { ray } = getLesmaTextures();
  const camera = useThree((s) => s.camera);
  return (
    <>
      {RAYS.map((rr, i) => (
        <mesh key={i} position={[rr.x, 4, rr.z]} rotation={[0, Math.atan2(camera.position.x - rr.x, camera.position.z - rr.z), 0.2]}>
          <planeGeometry args={[rr.w, 22]} />
          <meshBasicMaterial map={ray} transparent opacity={(0.1 + 0.05 * Math.sin(frame * 0.05 + rr.ph)) * boost} blending={THREE.AdditiveBlending} depthWrite={false} color="#f4fbe0" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
};

const BOKEH = (() => {
  const r = rng(31);
  return Array.from({ length: 34 }, () => ({
    p: [-6 + r() * 12, -0.5 + r() * 5, -3 - r() * 9] as V3,
    s: 0.25 + r() * 0.9,
    c: ["#d8f2ea", "#e9f4c6", "#a6dccf", "#f5efd6"][Math.floor(r() * 4)],
    o: 0.18 + r() * 0.3,
    ph: r() * 6,
  }));
})();
const Bokeh: React.FC<{ frame: number }> = ({ frame }) => {
  const { dot } = getLesmaTextures();
  return (
    <>
      {BOKEH.map((b, i) => (
        <sprite key={i} position={[b.p[0] + 0.2 * Math.sin(frame * 0.01 + b.ph), b.p[1] + 0.15 * Math.sin(frame * 0.013 + b.ph), b.p[2]]} scale={[b.s, b.s, 1]}>
          <spriteMaterial map={dot} color={b.c} transparent opacity={b.o} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </>
  );
};

const Particles: React.FC<{ frame: number; n: number; seed: number; box: [V3, V3]; size: number; opacity: number }> = ({ frame, n, seed, box, size, opacity }) => {
  const { dot } = getLesmaTextures();
  const geom = useMemo(() => {
    const r = rng(seed);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++)
      pos.set([box[0][0] + r() * (box[1][0] - box[0][0]), box[0][1] + r() * (box[1][1] - box[0][1]), box[0][2] + r() * (box[1][2] - box[0][2])], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [n, seed, box]);
  return (
    <points geometry={geom} position={[0.15 * Math.sin(frame * 0.012), (frame * 0.0025) % 1.5, 0]}>
      <pointsMaterial map={dot} size={size} transparent opacity={opacity} depthWrite={false} color="#f2fbf5" blending={THREE.AdditiveBlending} />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Foreground props (sharp layer)
// ---------------------------------------------------------------------------
const PLATFORM = { R: 13, spread: 1.5 };
const LeafPlatform: React.FC = () => {
  const geo = useMemo(() => fanGeometry(PLATFORM.R, PLATFORM.spread, 5), []);
  const mat = useMemo(() => velvet("#6b7a3a"), []);
  // lying flat, apex behind her, opening towards the camera
  return <mesh geometry={geo} material={mat} position={[0, -0.12, -6.2]} rotation={[Math.PI / 2, 0, 0]} />;
};

const RiceGrain: React.FC = () => {
  const mat = useMemo(() => makeSSS({ base: "#fbf6e8", deep: "#e3d8bd", rim: "#ffffff", rimAmt: 0.45 }), []);
  return (
    // rice-grain shape: elongated ellipsoid, slightly flattened
    <mesh position={[1.8, 0.28, 0.7]} rotation={[0, 0.7, 0]} scale={[0.95, 0.3, 0.36]} material={mat}>
      <sphereGeometry args={[1, 48, 32]} />
    </mesh>
  );
};

// Chloroplast capsules: leaf -> mouth (scene 4), head -> into the leaves (scene 5)
const N_CAP = 26;
const CAPS = (() => {
  const r = rng(13);
  const t4a = S[3] + 18, t4b = sceneEnd(3) - 26;
  const t5a = S[4] + 6, t5b = S[4] + 110;
  return Array.from({ length: N_CAP }, (_, j) => ({
    from: new THREE.Vector3(-0.3 + r() * 0.6, 0.03, 1.35 + r() * 0.45),
    eatAt: t4a + ((t4b - t4a) * j) / (N_CAP - 1),
    goAt: t5a + ((t5b - t5a) * j) / (N_CAP - 1),
    target: CERATA[Math.floor(r() * CERATA.length)],
    k: 0.45 + r() * 0.35,
  }));
})();
const MOUTH = new THREE.Vector3(0, 0.2, 1.12);

const Capsules: React.FC<{ frame: number }> = ({ frame }) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshStandardMaterial({ color: "#7dff7a", emissive: "#2fd34a", emissiveIntensity: 0.9, roughness: 0.3 }),
      N_CAP,
    );
    m.frustumCulled = false;
    return m;
  }, []);
  const d = new THREE.Object3D();
  const p = new THREE.Vector3();
  let any = false;
  CAPS.forEach((c, j) => {
    let s = 0;
    if (frame >= c.eatAt && frame < c.eatAt + 22) {
      const k = ease((frame - c.eatAt) / 22);
      p.copy(c.from).lerp(MOUTH, k);
      p.y += Math.sin(k * Math.PI) * 0.25;
      s = 1 - 0.4 * k;
    } else if (frame >= c.goAt && frame < c.goAt + 30) {
      const k = ease((frame - c.goAt) / 30);
      const dest = c.target.base.clone().lerp(c.target.tip, c.k);
      p.copy(new THREE.Vector3(0, 0.45, 0.8)).lerp(dest, k);
      p.y += Math.sin(k * Math.PI) * 0.3;
      s = k < 0.8 ? 1 : (1 - k) / 0.2;
    }
    if (s > 0) any = true;
    d.position.copy(p);
    d.scale.set(0.06 * s, 0.04 * s, 0.04 * s);
    d.updateMatrix();
    mesh.setMatrixAt(j, d.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (!any) return null;
  return <primitive object={mesh} />;
};

// ---------------------------------------------------------------------------
// Character state per frame
// ---------------------------------------------------------------------------
const blinkAt = (f: number, at: number) => interpolate(f, [at, at + 3, at + 6], [0, 1, 0], clamp);

const sheepState = (f: number) => {
  const sc = sceneOf(f);
  const t = f / FPS;
  const pale =
    interpolate(f, [S[5] + 8, sceneEnd(5) - 6], [0, 0.88], { ...clamp, easing: Easing.inOut(Easing.quad) }) *
    interpolate(f, [S[6], S[6] + 10], [1, 0], clamp);
  const glow = interpolate(f, [S[4] + 20, S[4] + 120, sceneEnd(4) - 8, sceneEnd(4) + 10], [0, 0.55, 0.55, 0.1], clamp);
  const back = 0.55 + interpolate(f, [S[4], S[4] + 20, sceneEnd(4) - 8, sceneEnd(4) + 10], [0, 1.1, 1.1, 0], clamp);
  const blink = Math.max(blinkAt(f, 34), blinkAt(f, S[1] + 70), blinkAt(f, S[6] + 22), blinkAt(f, S[3] + 90));
  const earWave = sc === 0 || sc === 6 ? 0.22 : 0.05;
  const earDroop = interpolate(f, [S[5] + 20, S[5] + 50, sceneEnd(5) - 2, sceneEnd(5) + 6], [0, 1, 1, 0], clamp);
  const lookDown = interpolate(f, [S[5] + 25, S[5] + 50, sceneEnd(5) - 2, sceneEnd(5) + 6], [0, 1, 1, 0], clamp);
  const mouth = sc === 5 ? -interpolate(f, [S[5] + 25, S[5] + 40], [0, 1], clamp) : sc === 6 ? interpolate(f, [S[6] + 4, S[6] + 14], [0, 1], clamp) : 0;
  const nib = sc === 3 ? Math.pow(Math.max(0, Math.sin((2 * Math.PI * (f - S[3])) / 20)), 2) * interpolate(f, [S[3] + 8, S[3] + 16], [0, 1], clamp) : 0;
  const hop = sc === 6 ? Math.abs(Math.sin(((f - S[6]) / 30) * Math.PI * 1.6)) * 0.05 : 0;
  return { t, pale, glow, back, blink, earWave, earDroop, lookDown, mouth, nibble: nib, hop };
};

// ---------------------------------------------------------------------------
const Lights: React.FC<{ dir: THREE.Vector3 }> = ({ dir }) => (
  <>
    <ambientLight intensity={0.55} color="#8fc7cf" />
    <hemisphereLight args={["#d8f3ef", "#4c6a52", 0.7]} />
    <directionalLight position={[dir.x * 10, dir.y * 10, dir.z * 10]} intensity={2.0} color="#fff3da" />
  </>
);

export const OvelhaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const sand = isSandSet(frame);
  const dir = lightDirFor(frame);
  const st = sheepState(frame);
  const sc = sceneOf(frame);
  const rayBoost = 1 + interpolate(frame, [S[4], S[4] + 20, sceneEnd(4) - 6, sceneEnd(4) + 6], [0, 1.6, 1.6, 0], clamp);
  return (
    <>
      {/* background layer: blurred = shallow depth of field */}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 35, near: 0.05, far: 200 }}
        style={{ filter: "blur(9px) saturate(0.95)", scale: "1.05" }}
      >
        <CameraRig frame={frame} />
        <WaterBackground />
        <fog attach="fog" args={[WATER, 8, 30]} />
        <Lights dir={dir} />
        <SandFloor frame={frame} y={sand ? 0 : -1.6} />
        <AlgaeFans frame={frame} baseY={sand ? 0 : -1.6} />
        <SunRays frame={frame} boost={rayBoost} />
        <Bokeh frame={frame} />
        <Particles frame={frame} n={260} seed={4} box={[[-8, -1.5, -12], [8, 6, -2]]} size={0.08} opacity={0.5} />
      </ThreeCanvas>
      {/* sharp layer: the sea sheep and what she stands on */}
      <ThreeCanvas width={width} height={height} camera={{ fov: 35, near: 0.05, far: 200 }} gl={{ alpha: true, antialias: true }} style={{ position: "absolute", inset: 0 }}>
        <CameraRig frame={frame} />
        <Lights dir={dir} />
        {sand ? (
          <>
            <SandFloor frame={frame} y={-0.01} radius={3.2} size={8} />
            <RiceGrain />
          </>
        ) : (
          <LeafPlatform />
        )}
        <group position={[0, st.hop, 0]}>
          <Sheep
            t={st.t}
            blink={st.blink}
            earWave={st.earWave}
            earDroop={st.earDroop}
            pale={st.pale}
            glow={st.glow}
            back={st.back}
            lightDir={dir}
            mouth={st.mouth}
            nibble={st.nibble}
            lookDown={st.lookDown}
          />
        </group>
        {(sc === 3 || sc === 4) && <Capsules frame={frame} />}
        <Particles frame={frame} n={70} seed={8} box={[[-3, -0.2, -1], [3, 3, 4]]} size={0.025} opacity={0.6} />
      </ThreeCanvas>
    </>
  );
};
