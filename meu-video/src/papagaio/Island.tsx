// Seen from above: the white sand islet with coconut palms, its turquoise lagoon and the reef ring.
import React, { useMemo } from "react";
import * as THREE from "three";
import { fbm3, memo, ribbon, rng, V } from "./gfx";

export const ISLAND_R = 6;
export const REEF_R = 20;

const palmGeo = (seed: number) =>
  memo("palm" + seed, () => {
    const r = rng(seed * 7 + 2);
    const lean = V((r() - 0.5) * 1.6, 0, (r() - 0.5) * 1.6);
    const h = 3 + r() * 1.2;
    const curve = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(lean.x * 0.2, h * 0.6, lean.z * 0.2), V(lean.x, h, lean.z));
    const trunk = new THREE.TubeGeometry(curve, 12, 0.13, 7);
    const top = V(lean.x, h, lean.z);
    const fronds: THREE.BufferGeometry[] = [];
    const n = 11;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.4;
      const dir = V(Math.cos(a), 0, Math.sin(a));
      const side = V(-Math.sin(a), 0, Math.cos(a));
      const L = 2.1 + r() * 0.7;
      const droop = 0.9 + r() * 0.5;
      const A: THREE.Vector3[] = [];
      const B: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const s = i / 10;
        const p = top
          .clone()
          .addScaledVector(dir, L * s)
          .add(V(0, (0.55 * s - droop * s * s) * L * 0.55, 0));
        const w = 0.34 * Math.sin(Math.PI * Math.min(1, s * 0.96 + 0.04) ** 0.7);
        A.push(p.clone().addScaledVector(side, w).add(V(0, -w * 0.45, 0)));
        B.push(p.clone().addScaledVector(side, -w).add(V(0, -w * 0.45, 0)));
        if (i === 10) {
          A[i] = p.clone();
          B[i] = p.clone();
        }
      }
      // two halves so the leaf has a ridge in the middle
      const mid = A.map((p, i) => p.clone().lerp(B[i], 0.5).add(V(0, 0.34 * Math.sin((Math.PI * i) / 10) * 0.45, 0)));
      fronds.push(ribbon(A, mid, 1), ribbon(mid, B, 1));
    }
    return { trunk, fronds, top };
  });

const islandGeo = () =>
  memo("island", () => {
    const g = new THREE.CircleGeometry(1, 72, 0, Math.PI * 2);
    // rebuild as rings for a smooth dome
    const rings = 16;
    const seg = 72;
    const pos: number[] = [0, 1, 0];
    const idx: number[] = [];
    for (let i = 1; i <= rings; i++)
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const k = i / rings;
        const wob = 1 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 5 + 2.5) + 0.03 * Math.sin(a * 9);
        const rr = k * wob;
        const y = (1 - k * k) ** 1.4 + 0.04 * fbm3(Math.cos(a) * rr * 4, 0, Math.sin(a) * rr * 4) * (1 - k);
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      }
    for (let j = 0; j < seg; j++) idx.push(0, 1 + ((j + 1) % seg), 1 + j);
    for (let i = 1; i < rings; i++)
      for (let j = 0; j < seg; j++) {
        const a = 1 + (i - 1) * seg + j;
        const b = 1 + (i - 1) * seg + ((j + 1) % seg);
        const c = a + seg;
        const d = b + seg;
        idx.push(a, b, c, b, d, c);
      }
    g.dispose();
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setIndex(idx);
    out.computeVertexNormals();
    return out;
  });

const waterMat = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsland: { value: ISLAND_R },
      uSand: { value: 0 },
      uNight: { value: 0 },
    },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uIsland; uniform float uSand;
      varying vec2 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ return 0.5*noise(p) + 0.25*noise(p*2.1+3.0) + 0.125*noise(p*4.3+7.0) + 0.0625*noise(p*8.7); }
      void main(){
        float ang = atan(vP.y, vP.x);
        float wob = 1.0 + 0.1*sin(ang*3.0+1.0) + 0.06*sin(ang*5.0+2.5) + 0.03*sin(ang*9.0);
        float r = length(vP) / wob;
        float n = fbm(vP * 0.22);
        float d = r - uIsland;                       // distance from the beach
        float reef = ${"20.0"} + (n - 0.5) * 7.0;    // wobbly reef crest
        vec3 shallow = vec3(0.50, 0.94, 0.86);
        vec3 lagoon = vec3(0.10, 0.80, 0.80);
        vec3 deep = vec3(0.02, 0.33, 0.66);
        vec3 col = mix(shallow, lagoon, smoothstep(0.0, 6.0, d));
        // coral patches inside the lagoon and on the crest
        float patches = smoothstep(0.55, 0.75, fbm(vP * 0.55 + 11.0)) * smoothstep(3.0, 7.0, d);
        col = mix(col, vec3(0.16, 0.50, 0.50), patches * 0.55);
        float crest = smoothstep(reef - 4.0, reef - 0.5, r) * (1.0 - smoothstep(reef + 0.5, reef + 3.5, r));
        col = mix(col, vec3(0.30, 0.62, 0.55), crest * 0.7 * (0.5 + 0.5 * fbm(vP * 1.3)));
        col = mix(col, deep, smoothstep(reef + 0.5, reef + 9.0, r));
        // waves rolling in: over the crest and on the beach
        float ph = r * 1.5 + uTime * 2.2 + n * 6.0;
        float line = smoothstep(0.86, 1.0, sin(ph)) * (0.35 + 0.65 * noise(vP * 0.7 + uTime * 0.3));
        float surf = line * (crest * 1.0 + (1.0 - smoothstep(0.2, 3.5, d)) * 0.9 + 0.03);
        // wet edge foam on the beach
        float lap = smoothstep(0.35 + 0.25 * sin(uTime * 2.0 + ang * 4.0), 0.0, d);
        col = mix(col, vec3(1.0), clamp(surf * 0.8 + lap * 0.6, 0.0, 1.0));
        // sand travelling from the reef to the beach
        float lane = smoothstep(0.5, 0.78, noise(vec2(ang * 5.0, r * 0.9 + uTime * 2.4))) * (0.6 + 0.4 * noise(vP * 1.7));
        float travel = lane * smoothstep(reef + 1.0, reef - 3.0, r) * smoothstep(0.0, 1.5, d);
        col = mix(col, vec3(1.0, 0.95, 0.80), travel * uSand * 0.8);
        // sun glints
        col += vec3(1.0) * pow(noise(vP * 3.0 + uTime * 1.5), 14.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });

export const AerialSet: React.FC<{ t: number; grow?: number; sand?: number }> = ({ t, grow = 0, sand = 0 }) => {
  const water = useMemo(waterMat, []);
  const R = ISLAND_R * (1 + 0.16 * grow);
  water.uniforms.uTime.value = t;
  water.uniforms.uIsland.value = R * 1.02;
  water.uniforms.uSand.value = sand;
  const palms = useMemo(
    () => [
      { p: V(0.4, 0, -0.6), s: 1.15, seed: 1 },
      { p: V(-1.6, 0, 0.9), s: 0.95, seed: 2 },
      { p: V(1.9, 0, 1.1), s: 0.85, seed: 3 },
    ],
    [],
  );
  const mats = useMemo(
    () => ({
      sand: new THREE.MeshStandardMaterial({ color: "#ffefc8", roughness: 1, emissive: new THREE.Color("#ffe9b8"), emissiveIntensity: 0.2 }),
      trunk: new THREE.MeshStandardMaterial({ color: "#8a6a48", roughness: 0.9 }),
      leaf: new THREE.MeshStandardMaterial({ color: "#3db34a", roughness: 0.7, side: THREE.DoubleSide }),
      bush: new THREE.MeshStandardMaterial({ color: "#58c04c", roughness: 0.9 }),
      nut: new THREE.MeshStandardMaterial({ color: "#5a4028", roughness: 0.7 }),
    }),
    [],
  );
  const bushes = useMemo(() => {
    const r = rng(19);
    return Array.from({ length: 9 }, () => {
      const a = r() * 6.28;
      const d = r() * 2.4;
      return [Math.cos(a) * d, 0.75 - d * 0.12, Math.sin(a) * d, 0.35 + r() * 0.35] as const;
    });
  }, []);
  return (
    <group>
      <color attach="background" args={["#0a63b0"]} />
      <hemisphereLight args={["#ffffff", "#8fe0d8", 1.5]} />
      <directionalLight position={[8, 20, 6]} intensity={2.4} color="#fff4d6" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={water}>
        <planeGeometry args={[500, 500]} />
      </mesh>
      <mesh geometry={islandGeo()} material={mats.sand} scale={[R, 1.0, R]} position={[0, -0.02, 0]} />
      {bushes.map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} scale={[s * 1.3, s * 0.7, s * 1.3]} material={mats.bush}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
      {palms.map((pl) => {
        const g = palmGeo(pl.seed);
        const sway = 0.04 * Math.sin(t * 1.7 + pl.seed);
        return (
          <group key={pl.seed} position={[pl.p.x, 0.75, pl.p.z]} scale={pl.s} rotation={[sway, 0, sway * 0.7]}>
            <mesh geometry={g.trunk} material={mats.trunk} />
            {g.fronds.map((f, i) => (
              <mesh key={i} geometry={f} material={mats.leaf} />
            ))}
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[g.top.x + Math.cos(k * 2.1) * 0.16, g.top.y - 0.16, g.top.z + Math.sin(k * 2.1) * 0.16]} material={mats.nut}>
                <sphereGeometry args={[0.13, 8, 6]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};
