import React, { useMemo } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Translucent "subsurface-ish" shader: wrap lighting + back-light transmission
// + fresnel rim, optional cell-dot texture and a coloured tip (uv.y along the
// lathe profile). Frame-driven uniforms only.
// ---------------------------------------------------------------------------
const vert = /* glsl */ `
  varying vec3 vN; varying vec3 vWP; varying vec2 vUv; varying vec3 vLP;
  void main(){
    vUv = uv; vLP = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const frag = /* glsl */ `
  uniform vec3 uBase; uniform vec3 uDeep; uniform vec3 uTip; uniform vec3 uRim;
  uniform vec3 uLightDir; uniform vec3 uLightCol; uniform vec3 uAmb; uniform vec3 uPaleCol;
  uniform float uTipStart; uniform float uDots; uniform float uGlow; uniform float uPale;
  uniform float uBack; uniform float uSeed; uniform float uRimAmt; uniform float uAlpha;
  varying vec3 vN; varying vec3 vWP; varying vec2 vUv; varying vec3 vLP;
  float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float cell(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); float d = 1.0;
    for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
      vec3 g = vec3(float(x),float(y),float(z));
      vec3 o = vec3(hash(i+g), hash(i+g+11.1), hash(i+g+23.7));
      vec3 r = g + o - f; d = min(d, dot(r,r));
    }
    return sqrt(d);
  }
  void main(){
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWP);
    if (dot(N, V) < 0.0) N = -N;
    vec3 L = normalize(uLightDir);
    float ndv = max(dot(N, V), 0.0);
    float rim = pow(1.0 - ndv, 2.2);
    float wrap = max(0.0, (dot(N, L) + 0.6) / 1.6);
    float trans = pow(max(0.0, dot(V, -L)), 2.0) * 0.7 + rim * 0.5;
    vec3 col = mix(uDeep, uBase, 0.45 + 0.55 * ndv);
    if (uDots > 0.0) {
      float c = cell(vLP * uDots + uSeed);
      float spot = 1.0 - smoothstep(0.2, 0.36, c);
      col = mix(col, uDeep * 0.8, spot * 0.5);
      float spark = 1.0 - smoothstep(0.04, 0.11, c);
      col += spark * vec3(0.20, 0.24, 0.03);
    }
    col = mix(col, uPaleCol, uPale);
    float tip = smoothstep(uTipStart, 1.0, vUv.y);
    col = mix(col, uTip, tip);
    vec3 lit = col * (uAmb + wrap * uLightCol)
             + col * trans * uBack * uLightCol
             + rim * uRim * uRimAmt
             + col * uGlow;
    gl_FragColor = vec4(lit, uAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

type MatOpts = {
  base: string; deep: string; tip?: string; rim?: string; tipStart?: number; dots?: number; seed?: number; rimAmt?: number;
};
export const makeSSS = (o: MatOpts) =>
  new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uBase: { value: new THREE.Color(o.base) },
      uDeep: { value: new THREE.Color(o.deep) },
      uTip: { value: new THREE.Color(o.tip ?? o.base) },
      uRim: { value: new THREE.Color(o.rim ?? "#ffffff") },
      uPaleCol: { value: new THREE.Color("#dfe8d6") },
      uLightDir: { value: new THREE.Vector3(-0.4, 1, 0.6) },
      uLightCol: { value: new THREE.Color("#fff3dc") },
      uAmb: { value: new THREE.Color("#3b6a72") },
      uTipStart: { value: o.tipStart ?? 2 },
      uDots: { value: o.dots ?? 0 },
      uGlow: { value: 0 },
      uPale: { value: 0 },
      uBack: { value: 0.6 },
      uSeed: { value: o.seed ?? 0 },
      uRimAmt: { value: o.rimAmt ?? 0.35 },
      uAlpha: { value: 1 },
    },
  });

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
const ceratasProfile = () => {
  const pts: THREE.Vector2[] = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // fat in the middle, rounded base, soft point at the tip
    const r = 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.8) * (1 - 0.12 * t);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), t));
  }
  return new THREE.LatheGeometry(pts, 20);
};

// Rhinophore ("ear"): thick base, tapering to a rounded tip, bent outwards/upwards.
// The ear points along local +y; `side` flips the bend so both curl upwards.
const EAR_LEN = 0.54;
export const earGeometry = (side: number) => {
  const pts: THREE.Vector2[] = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let r = 0.125 * (1 - 0.45 * t) * (1 + 0.1 * Math.sin(t * Math.PI));
    if (t > 0.74) r *= Math.sqrt(Math.max(0, 1 - ((t - 0.74) / 0.26) ** 2));
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), t * EAR_LEN));
  }
  const g = new THREE.LatheGeometry(pts, 28);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / EAR_LEN;
    // curl up (world up = -side * local x for these ear rotations) and slightly forward
    p.setX(i, p.getX(i) - side * 0.075 * y * y);
    p.setZ(i, p.getZ(i) + 0.05 * y * y);
  }
  g.computeVertexNormals();
  return g;
};

const rand = (s: number) => () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type CerasInfo = { base: THREE.Vector3; dir: THREE.Vector3; len: number; tip: THREE.Vector3 };

/** Layout of the dorsal leaves (cerata), in sheep-local space (head towards +z). */
export const CERATA: CerasInfo[] = (() => {
  const r = rand(42);
  const rows = [
    { z: 0.6, n: 4, len: 0.8 },
    { z: 0.36, n: 5, len: 0.96 },
    { z: 0.1, n: 5, len: 1.02 },
    { z: -0.16, n: 5, len: 1.0 },
    { z: -0.42, n: 5, len: 0.93 },
    { z: -0.68, n: 4, len: 0.84 },
    { z: -0.92, n: 3, len: 0.72 },
    { z: -1.12, n: 2, len: 0.6 },
  ];
  const out: CerasInfo[] = [];
  const halfW = (z: number) => 0.44 * Math.sqrt(Math.max(0.05, 1 - ((z + 0.2) / 1.45) ** 2));
  rows.forEach((row, ri) => {
    const sides: number[] = ri % 2 === 1 ? [0, -1, 1] : [-1, 1];
    for (const side of sides) {
      const n = side === 0 ? 1 : row.n;
      for (let k = 0; k < n; k++) {
        const a = side === 0 ? 0 : THREE.MathUtils.degToRad(14 + (96 - 14) * (k / Math.max(1, n - 1)) + (ri % 2) * 6);
        const s = side === 0 ? 1 : side;
        const base = new THREE.Vector3(s * halfW(row.z) * Math.sin(a) * 0.9 * (side === 0 ? 0 : 1), 0.27 + 0.22 * Math.cos(a), row.z);
        const back = 0.12 + 0.38 * (ri / (rows.length - 1));
        const dir = new THREE.Vector3(
          side === 0 ? 0 : s * Math.sin(a * 1.06),
          Math.cos(a * 1.06) + 0.1,
          -back + (ri === 0 ? 0.08 : 0),
        ).normalize();
        const len = row.len * (1 - 0.2 * (k / Math.max(1, n - 1))) * (0.9 + 0.2 * r());
        out.push({ base, dir, len, tip: base.clone().addScaledVector(dir, len) });
      }
    }
  });
  return out;
})();

// ---------------------------------------------------------------------------
export type SheepProps = {
  t: number; // seconds (frame-driven)
  blink: number; // 0 open .. 1 closed
  earWave: number; // amplitude of the ear waggle
  earDroop: number; // 0 .. 1 (sad)
  pale: number; // 0 green .. 1 pale
  glow: number; // extra emission in the leaves
  back: number; // back-light transmission amount
  lightDir: THREE.Vector3;
  mouth: number; // -1 frown, 0 none, 1 smile
  nibble: number; // 0..1 head dip
  lookDown: number; // 0..1
};

export const Sheep: React.FC<SheepProps> = (p) => {
  const mats = useMemo(() => {
    const leaves = Array.from({ length: 6 }, (_, i) =>
      makeSSS({ base: "#93d22a", deep: "#4c9316", tip: "#9f80ff", rim: "#d9ff9a", tipStart: 0.76, dots: 12, seed: i * 13.7, rimAmt: 0.3 }),
    );
    const body = makeSSS({ base: "#f3faee", deep: "#cfe7c2", rim: "#f4fff0", dots: 0, rimAmt: 0.45 });
    // velvety: very fine speckles + soft sheen at the rim; tip darker
    const ear = makeSSS({ base: "#56688c", deep: "#2a3450", tip: "#1c2335", rim: "#b8c8e8", tipStart: 0.7, dots: 70, seed: 3, rimAmt: 0.55 });
    return { leaves, body, ear };
  }, []);
  const geo = useMemo(() => ({ ceras: ceratasProfile(), earL: earGeometry(-1), earR: earGeometry(1) }), []);

  // uniforms (frame-driven)
  for (const m of [...mats.leaves, mats.body, mats.ear]) {
    m.uniforms.uLightDir.value.copy(p.lightDir);
    m.uniforms.uBack.value = p.back;
  }
  for (const m of mats.leaves) {
    m.uniforms.uPale.value = p.pale;
    m.uniforms.uGlow.value = p.glow;
  }

  const t = p.t;
  const faceRotX = 0.32 * p.nibble + 0.12 * p.lookDown;
  const eyeScaleY = Math.max(0.08, 1 - p.blink) * (1 - 0.15 * p.lookDown);

  return (
    <group>
      {/* body (mostly hidden under the leaves) */}
      <mesh position={[0, 0.24, -0.2]} scale={[0.48, 0.3, 1.3]} material={mats.body}>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>

      {/* cerata */}
      {CERATA.map((c, i) => {
        const y = c.dir;
        const radial = new THREE.Vector3(c.base.x, c.base.y - 0.2, 0);
        if (radial.lengthSq() < 1e-4) radial.set(0, 1, 0);
        let z = radial.clone().sub(y.clone().multiplyScalar(radial.dot(y)));
        if (z.lengthSq() < 1e-4) z = new THREE.Vector3(0, 0, 1);
        z.normalize();
        const x = new THREE.Vector3().crossVectors(y, z).normalize();
        const m = new THREE.Matrix4().makeBasis(x, y, z);
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        const sway = new THREE.Quaternion().setFromAxisAngle(x, 0.06 * Math.sin(t * 1.6 + i * 0.7));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.05 * Math.sin(t * 1.3 + i)));
        q.premultiply(sway);
        const w = c.len * 0.38;
        return (
          <group key={i} position={c.base} quaternion={q}>
            <mesh geometry={geo.ceras} scale={[w, c.len, w * 0.72]} material={mats.leaves[i % mats.leaves.length]} />
          </group>
        );
      })}

      {/* head */}
      <group position={[0, 0.25, 0.86]} rotation={[faceRotX, 0, 0]}>
        <mesh position={[0, -0.03, 0.02]} scale={[0.31, 0.36, 0.27]} material={mats.body}>
          <sphereGeometry args={[1, 48, 36]} />
        </mesh>
        {/* lilac spots */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.18, -0.12, 0.24]} scale={[0.038, 0.03, 0.012]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color="#c9b6ff" emissive="#7a5fd6" emissiveIntensity={0.35} roughness={0.5} />
          </mesh>
        ))}
        {/* eyes: small, round, close together, just above the face centre */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.068, 0.075 - 0.02 * p.lookDown, 0.275]} scale={[1, eyeScaleY, 1]}>
            <mesh scale={[0.05, 0.05, 0.04]}>
              <sphereGeometry args={[1, 24, 18]} />
              <meshStandardMaterial color="#07080c" roughness={0.12} metalness={0.1} />
            </mesh>
            <mesh position={[-0.016, 0.018, 0.035]} scale={0.013}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          </group>
        ))}
        {/* mouth (only when needed) */}
        {p.mouth !== 0 && (
          <mesh position={[0, -0.05, 0.285]} rotation={[0, 0, p.mouth > 0 ? Math.PI : 0]} scale={Math.abs(p.mouth)}>
            <torusGeometry args={[0.035, 0.007, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#3a3f4a" roughness={0.6} />
          </mesh>
        )}
        {/* ears (rhinophores): thick, rounded, slate blue, sideways */}
        {[-1, 1].map((s) => {
          const wave = p.earWave * Math.sin(t * 5 + (s > 0 ? 0.6 : 0));
          const droop = 0.55 * p.earDroop;
          return (
            <group key={s} position={[s * 0.18, 0.17, 0.04]} rotation={[0.12, s * -0.22, s * (-1.5 - droop + wave)]}>
              <mesh geometry={s > 0 ? geo.earR : geo.earL} material={mats.ear} />
            </group>
          );
        })}
      </group>
    </group>
  );
};
