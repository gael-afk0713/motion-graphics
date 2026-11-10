// The shallow tropical reef: water, light shafts, caustics, corals, particles,
// plus the reusable effects (sand cloud, bubbles, isopod swarm).
import React, { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  alphaPoints,
  brainTexture,
  grainSprite,
  bubbleSprite,
  CAUSTIC,
  causticMaterial,
  fbm3,
  grainTexture,
  memo,
  mix,
  raySprite,
  rng,
  sat,
  softSprite,
  V,
} from "./gfx";

const C = (h: string) => new THREE.Color(h);
const lerpC = (a: string, b: string, t: number) => C(a).lerp(C(b), sat(t));

// ---------------------------------------------------------------------------
// Water + light
// ---------------------------------------------------------------------------
export type EnvProps = {
  t: number;
  /** 0 = day, 1 = night */
  night?: number;
  /** 0..1: darken the water for the x-ray shots */
  dim?: number;
  cam: THREE.Vector3;
  floor?: boolean;
  rays?: number;
};

export const waterColors = (night: number, dim: number) => {
  const d = (c: THREE.Color) => c.lerp(C("#031a2e"), dim * 0.82);
  return {
    top: d(lerpC("#c9fbf0", "#1f4a94", night)),
    mid: d(lerpC("#27c3cc", "#0a1f4c", night)),
    bot: d(lerpC("#0b84ad", "#040b20", night)),
  };
};

export const ReefEnv: React.FC<EnvProps> = ({ t, night = 0, dim = 0, cam, floor = true, rays = 1 }) => {
  const col = waterColors(night, dim);
  CAUSTIC.time.value = t * 0.9;
  CAUSTIC.strength.value = mix(1, 0.22, night) * (1 - 0.7 * dim);
  const dome = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTop: { value: C("#fff") }, uMid: { value: C("#fff") }, uBot: { value: C("#fff") } },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; varying vec3 vP;
          void main(){ float y = normalize(vP).y;
            vec3 c = y > 0.0 ? mix(uMid, uTop, pow(smoothstep(0.0, 0.85, y), 0.8)) : mix(uMid, uBot, smoothstep(0.0, -0.5, y));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  dome.uniforms.uTop.value = col.top;
  dome.uniforms.uMid.value = col.mid;
  dome.uniforms.uBot.value = col.bot;

  const floorObj = useMemo(() => {
    const g = new THREE.PlaneGeometry(200, 70, 160, 56);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setY(i, 0.5 * (fbm3(p.getX(i) * 0.18, 0, p.getZ(i) * 0.18) - 0.5) + 0.05 * Math.sin(p.getX(i) * 2.2 + p.getZ(i) * 0.7));
    g.computeVertexNormals();
    const tx = grainTexture().clone();
    tx.repeat.set(60, 22);
    tx.needsUpdate = true;
    return { g, m: causticMaterial({ color: "#f3e6c2", map: tx, roughness: 1 }, 1.5, 0.14) };
  }, []);

  const shafts = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: 11 }, (_, i) => ({
      x: -9 + i * 1.9 + r() * 1.2,
      z: -9 + r() * 7,
      w: 1.2 + r() * 2.4,
      ph: r() * 6.28,
      a: 0.1 + r() * 0.12,
    }));
  }, []);
  const motes = useMemo(() => {
    const r = rng(8);
    const N = 420;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      arr[i * 3] = (r() - 0.5) * 24;
      arr[i * 3 + 1] = r() * 12 - 2;
      arr[i * 3 + 2] = (r() - 0.5) * 16;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const rayAlpha = rays * mix(1, 0.55, night) * (1 - 0.6 * dim);
  // the motes box follows the camera in steps, so they still drift past it
  const mx = Math.round(cam.x / 24) * 24;

  return (
    <group>
      <fogExp2 attach="fog" args={[col.mid, mix(0.03, 0.05, night)]} />
      <hemisphereLight args={[lerpC("#e6fdff", "#5a7fe0", night), lerpC("#2c95a8", "#081230", night), mix(1.55, 0.75, night) * (1 - 0.45 * dim)]} />
      <directionalLight position={[3, 10, 5]} color={lerpC("#fff3d4", "#b4ccff", night)} intensity={mix(2.3, 1.0, night) * (1 - 0.45 * dim)} />
      {night > 0.01 && <directionalLight position={[0, 9, -7]} color="#9fc0ff" intensity={1.7 * night} />}
      {night > 0.01 && <directionalLight position={[-1, 10, 1]} color="#b8d0ff" intensity={0.6 * night} />}
      <directionalLight position={[cam.x * 0 - 2, 2, 10]} color={lerpC("#ffffff", "#8fb0ff", night)} intensity={mix(0.75, 0.8, night)} />
      <mesh position={cam} material={dome}>
        <sphereGeometry args={[150, 24, 16]} />
      </mesh>
      {floor && <mesh geometry={floorObj.g} material={floorObj.m} position={[Math.round(cam.x / 20) * 20, 0, -8]} />}
      {/* god rays */}
      {rayAlpha > 0.01 &&
        shafts.map((s, i) => (
          <mesh key={i} position={[cam.x * 0.85 + s.x, 8.5, s.z]} rotation={[0, 0, 0.3]} renderOrder={5}>
            <planeGeometry args={[s.w, 24]} />
            <meshBasicMaterial
              map={raySprite()}
              color={lerpC("#f4fff2", "#9db8ff", night)}
              transparent
              opacity={rayAlpha * s.a * (0.7 + 0.3 * Math.sin(t * 1.3 + s.ph))}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              fog={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      {/* drifting particles */}
      {[0, 1].map((k) => (
        <points key={k} geometry={motes} position={[mx + (k ? 24 * Math.sign(cam.x - mx || 1) : 0) + 0.3 * Math.sin(t * 0.5), 0.12 * t % 3, cam.z - 7]} renderOrder={6}>
          <pointsMaterial map={softSprite()} size={0.07} transparent opacity={mix(0.55, 0.3, night)} depthWrite={false} color={lerpC("#ffffff", "#9fc0ff", night)} />
        </points>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Corals
// ---------------------------------------------------------------------------
export const rockGeometry = (seed: number, algae = 0.6, detail = 5) =>
  memo(`rock${seed}_${algae}_${detail}`, () => {
    const ico = new THREE.IcosahedronGeometry(1, detail);
    ico.deleteAttribute("normal");
    ico.deleteAttribute("uv");
    const g = mergeVertices(ico, 1e-4);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = fbm3(v.x * 1.4 + seed * 9.1, v.y * 1.4, v.z * 1.4, 4);
      v.multiplyScalar(0.78 + 0.5 * n + 0.05 * fbm3(v.x * 7, v.y * 7 + seed, v.z * 7, 2));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const nrm = g.attributes.normal;
    const col = new Float32Array(p.count * 3);
    const rock = C("#d9c3a8");
    const dark = C("#9c7f74");
    const green = C("#4fae3a");
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = fbm3(v.x * 3 + 4, v.y * 3 + seed, v.z * 3, 3);
      c.copy(dark).lerp(rock, n);
      const up = nrm.getY(i);
      const a = sat((up - 0.25) * 1.5) * sat((fbm3(v.x * 2.6 + seed, v.y * 2.6, v.z * 2.6, 2) - 0.38) * 4.0) * algae;
      c.lerp(green, a);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  });

const withColor = (g: THREE.BufferGeometry, k: number) => {
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(k), 3));
  return g;
};
const staghorn = (seed: number) =>
  memo("stag" + seed, () => {
    const r = rng(seed * 13 + 1);
    const parts: THREE.BufferGeometry[] = [];
    const up = V(0, 1, 0);
    const grow = (o: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
      const cyl = new THREE.CylinderGeometry(rad * 0.72, rad, len, 12, 3, true);
      cyl.translate(0, len / 2, 0);
      cyl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
      cyl.translate(o.x, o.y, o.z);
      const tip = o.clone().addScaledVector(dir, len);
      // lighter towards the tips, like living staghorn
      const tint = depth <= 0 ? 1 : depth === 1 ? 0.6 : depth === 2 ? 0.3 : 0.1;
      parts.push(withColor(cyl, mix(0.74, 1, tint)));
      // round joint / round tip
      const cap = new THREE.SphereGeometry(rad * 0.74, 12, 8);
      cap.translate(tip.x, tip.y, tip.z);
      parts.push(withColor(cap, mix(0.74, 1, depth <= 0 ? 1 : tint)));
      if (depth <= 0) return;
      const kids = depth >= 3 ? 3 : 2 + (r() > 0.6 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        const d = dir
          .clone()
          .add(V((r() - 0.5) * 1.5, 0.35 + r() * 0.3, (r() - 0.5) * 1.5))
          .normalize();
        grow(tip, d, len * (0.68 + r() * 0.15), rad * 0.74, depth - 1);
      }
    };
    for (let k = 0; k < 3; k++) grow(V((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4), V((r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8).normalize(), 0.55, 0.12, 3);
    return mergeGeometries(parts)!;
  });

const tableCoral = (seed: number) =>
  memo("table" + seed, () => {
    const parts: THREE.BufferGeometry[] = [];
    const stalk = new THREE.CylinderGeometry(0.2, 0.44, 1.05, 24, 4);
    stalk.translate(0, 0.5, 0);
    parts.push(stalk);
    [0, 1].forEach((k) => {
      const R = 1.5 - k * 0.55;
      // rounded plate: a lathe with a soft rim, slightly cupped
      const prof = [
        [0.001, -0.06],
        [R * 0.55, -0.07],
        [R * 0.9, -0.03],
        [R * 0.985, 0.02],
        [R, 0.06],
        [R * 0.97, 0.1],
        [R * 0.8, 0.1],
        [R * 0.4, 0.06],
        [0.001, 0.05],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const plate = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(28), 72);
      const p = plate.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const rr = Math.hypot(x, z) / R;
        const a = Math.atan2(z, x);
        const s2 = 1 + 0.1 * Math.sin(a * 5 + seed) * rr + 0.04 * Math.sin(a * 11 + seed * 2) * rr;
        p.setXYZ(i, x * s2, p.getY(i) + 0.16 * rr * rr + 0.025 * Math.sin(a * 7 + seed) * rr, z * s2);
      }
      plate.computeVertexNormals();
      plate.translate(k * 0.25, 1.06 + k * 0.4, k * 0.2);
      parts.push(plate);
    });
    return mergeGeometries(parts)!;
  });

const brainGeo = () =>
  memo("brainGeo", () => {
    const g = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.55);
    g.scale(1, 0.78, 1);
    return g;
  });

const tubeGeo = () =>
  memo("tubeGeo", () => {
    const r = rng(41);
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const h = 0.7 + r() * 0.9;
      const prof = [
        [0.1, 0],
        [0.13, h * 0.5],
        [0.17, h * 0.92],
        [0.18, h],
        [0.15, h + 0.02],
        [0.11, h * 0.9],
        [0.08, h * 0.5],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const c = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(16), 24);
      c.translate((r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7);
      parts.push(c);
    }
    return mergeGeometries(parts)!;
  });

// pink, purple, orange and yellow, a little muted so the fish stays the star
const PALETTE = ["#f08fb0", "#a987e0", "#f29a5c", "#edc866", "#ec8292", "#9a8fe6", "#f2b27c", "#de86c2"];
const BRAIN = ["#d8c29b", "#c7a447", "#8f9a5c", "#b7a2cc"];
type Item = { kind: number; x: number; z: number; s: number; rot: number; color: string; seed: number };
const layout = () =>
  memo("layout", () => {
    const r = rng(2024);
    const out: Item[] = [];
    // back band: dense and tall, behind the fish
    for (let x = -60; x <= 60; x += 1.25) {
      const z = -2.8 - r() * 9;
      const kind = Math.floor(r() * 5);
      const depth = (-z - 2.8) / 9;
      out.push({
        kind,
        x: x + (r() - 0.5) * 1.4,
        z,
        s: (0.75 + r() * 0.9) * (0.85 + depth * 0.9),
        rot: r() * 6.28,
        color: PALETTE[Math.floor(r() * PALETTE.length)],
        seed: 1 + Math.floor(r() * 3),
      });
    }
    // low foreground
    for (let x = -60; x <= 60; x += 3.1) {
      out.push({
        kind: [0, 1, 4][Math.floor(r() * 3)],
        x: x + (r() - 0.5) * 2,
        z: 1.6 + r() * 2.2,
        s: 0.3 + r() * 0.3,
        rot: r() * 6.28,
        color: PALETTE[Math.floor(r() * PALETTE.length)],
        seed: 1 + Math.floor(r() * 3),
      });
    }
    return out;
  });

const coralMat = (key: string, make: () => THREE.Material) => memo("mat" + key, make);

export const Coral: React.FC<{ item: Item }> = ({ item }) => {
  const { kind, x, z, s, rot, color, seed } = item;
  let geometry: THREE.BufferGeometry;
  let material: THREE.Material;
  let sy = 1;
  if (kind === 0) {
    geometry = rockGeometry(seed);
    material = coralMat("rock", () => causticMaterial({ vertexColors: true, roughness: 0.95, bumpMap: grainTexture(), bumpScale: 1.5 }, 0.9));
    sy = 0.75;
  } else if (kind === 1) {
    geometry = brainGeo();
    // natural brain-coral tones: beige, mustard, olive, soft lilac
    const bc = BRAIN[(color.charCodeAt(1) + color.charCodeAt(3) + color.charCodeAt(5)) % BRAIN.length];
    material = coralMat("brainN" + bc, () => {
      const tx = brainTexture();
      return causticMaterial({ color: bc, map: tx, bumpMap: tx, bumpScale: 1.4, roughness: 0.85 }, 0.9);
    });
  } else if (kind === 2) {
    geometry = staghorn(seed);
    material = coralMat("stag" + color, () => causticMaterial({ color, vertexColors: true, roughness: 0.6 }, 0.8));
  } else if (kind === 3) {
    geometry = tableCoral(seed);
    material = coralMat("table" + color, () => causticMaterial({ color, roughness: 0.75, bumpMap: grainTexture(), bumpScale: 2 }, 1));
  } else {
    geometry = tubeGeo();
    material = coralMat("tube" + color, () => causticMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }, 0.8));
  }
  return <mesh geometry={geometry} material={material} position={[x, kind === 0 ? 0.2 * s : 0, z]} rotation={[0, rot, 0]} scale={[s, s * sy, s]} />;
};

/** corals around camera x (only what can be seen is mounted) */
export const CoralField: React.FC<{ x: number; range?: number; skip?: (i: Item) => boolean }> = ({ x, range = 22, skip }) => (
  <group>
    {layout()
      .filter((i) => Math.abs(i.x - x) < range && !(skip && skip(i)))
      .map((i, k) => (
        <Coral key={`${i.x.toFixed(2)}_${k}`} item={i} />
      ))}
  </group>
);

// ---------------------------------------------------------------------------
// Sand cloud: a fine white cloud that sinks, sparkling
// ---------------------------------------------------------------------------
export type Emitter = (time: number) => THREE.Vector3;
export const SandCloud: React.FC<{
  /** current time in frames */
  f: number;
  /** emission window in frames */
  from: number;
  to: number;
  emitter: Emitter;
  count?: number;
  seed?: number;
  floorY?: number;
  /** backwards push (units/frame) at emission */
  push?: number;
  spread?: number;
  fall?: number;
  size?: number;
}> = ({ f, from, to, emitter, count = 520, seed = 1, floorY = 0.05, push = 0.02, spread = 1, fall = 0.022, size = 1 }) => {
  const sys = useMemo(() => {
    const r = rng(seed * 31 + 7);
    const rnd = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) rnd[i] = r();
    const mk = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
      return g;
    };
    return {
      rnd,
      puff: mk(),
      grain: mk(),
      puffMat: alphaPoints({ map: softSprite(), size: 0.42 * size, opacity: 0.1, color: "#fffaf0" }),
      grainMat: alphaPoints({ map: grainSprite(), size: 0.06 * size, opacity: 1, color: "#ffffff" }),
    };
  }, [count, seed, size]);
  const pp = sys.puff.attributes.position as THREE.BufferAttribute;
  const pc = sys.puff.attributes.aAlpha as THREE.BufferAttribute;
  const gp = sys.grain.attributes.position as THREE.BufferAttribute;
  const gc = sys.grain.attributes.aAlpha as THREE.BufferAttribute;
  for (let i = 0; i < count; i++) {
    const r0 = sys.rnd[i * 4];
    const r1 = sys.rnd[i * 4 + 1];
    const r2 = sys.rnd[i * 4 + 2];
    const r3 = sys.rnd[i * 4 + 3];
    const birth = from + ((i + r0) / count) * (to - from);
    const age = f - birth;
    if (age < 0) {
      pp.setXYZ(i, 0, -999, 0);
      gp.setXYZ(i, 0, -999, 0);
      continue;
    }
    const e = emitter(birth);
    const k = 1 - Math.exp(-age * 0.06);
    const x = e.x - push * 16 * k * (0.4 + r1) + 0.1 * spread * Math.sin(age * 0.07 + r2 * 9) * k;
    const z = e.z + (r2 - 0.5) * 0.5 * spread * k + 0.07 * Math.cos(age * 0.06 + r3 * 9) * k;
    const yRaw = e.y - fall * (0.5 + r3) * age * (0.35 + 0.65 * k) + (r1 - 0.5) * 0.3 * spread * k;
    const y = Math.max(floorY + r2 * 0.05, yRaw);
    const landed = yRaw < floorY ? 1 : 0;
    pp.setXYZ(i, x, y, z);
    gp.setXYZ(i, x + (r3 - 0.5) * 0.5 * spread * k, Math.max(floorY + r2 * 0.04, y + (r0 - 0.5) * 0.5 * spread * k), z + (r1 - 0.5) * 0.45 * spread * k);
    const fade = Math.min(1, age / 4) * Math.exp(-age * 0.008) * (landed ? 0.35 : 1);
    pc.setX(i, fade);
    const tw = 0.55 + 0.45 * Math.max(0, Math.sin(age * 0.5 + r0 * 40)) ** 3;
    const gfade = Math.min(1, age / 3) * (landed ? 0.5 : 1) * tw;
    gc.setX(i, gfade);
  }
  pp.needsUpdate = pc.needsUpdate = gp.needsUpdate = gc.needsUpdate = true;
  return (
    <group>
      <points geometry={sys.puff} material={sys.puffMat} frustumCulled={false} renderOrder={7} />
      <points geometry={sys.grain} material={sys.grainMat} frustumCulled={false} renderOrder={8} />
    </group>
  );
};

/** soft pile of white sand on the floor */
export const Mound: React.FC<{ grow: number } & Omit<React.ComponentProps<"mesh">, "scale">> = ({ grow, ...p }) => {
  const g = memo("mound", () => {
    const geo = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const q = geo.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const rr = Math.hypot(q.getX(i), q.getZ(i));
      q.setY(i, Math.exp(-rr * rr * 3.2) * 0.9 + 0.03 * fbm3(q.getX(i) * 6, 0, q.getZ(i) * 6));
    }
    geo.computeVertexNormals();
    return geo;
  });
  const m = memo("moundMat", () => causticMaterial({ color: "#fffaf0", roughness: 1, bumpMap: grainTexture(), bumpScale: 1 }, 1.3));
  if (grow <= 0.001) return null;
  return <mesh geometry={g} material={m} scale={[0.5 + 0.8 * grow, grow, 0.5 + 0.8 * grow]} {...p} />;
};

/** bubbles rising in a loose column */
export const Bubbles: React.FC<{ t: number; origin: [number, number, number]; count?: number; seed?: number; rate?: number; size?: number; letter?: string; spreadX?: number }> = ({
  t,
  origin,
  count = 14,
  seed = 1,
  rate = 0.5,
  size = 0.12,
  letter = "",
  spreadX = 0.4,
}) => {
  const rnd = useMemo(() => {
    const r = rng(seed * 17 + 3);
    return Array.from({ length: count }, () => [r(), r(), r()]);
  }, [count, seed]);
  return (
    <group>
      {rnd.map(([a, b, c], i) => {
        const raw = t * rate + a * 2 + (i / count) * 5;
        const life = raw % 5;
        // nothing before its first cycle starts (the stream begins empty)
        if (raw - a * 2 - (i / count) * 5 < 0 || t * rate < ((i / count) * 5 + a * 2) % 5 - 0.001 && raw < 5 && life > t * rate) return null;
        const y = origin[1] + life * 0.9;
        const s = size * (0.5 + b) * Math.min(1, life * 3);
        return (
          <sprite key={i} position={[origin[0] + (b - 0.5) * spreadX + 0.08 * Math.sin(life * 3 + c * 6), y, origin[2] + (c - 0.5) * 0.3]} scale={[s, s, s]} renderOrder={9}>
            <spriteMaterial map={bubbleSprite(letter)} transparent opacity={Math.min(1, (5 - life) * 0.8) * 0.9} depthWrite={false} />
          </sprite>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Parasites: tiny shrimp-like isopods (gnathiids), with glowing eyes
// ---------------------------------------------------------------------------
export const isopodGeo = () =>
  memo("isopod", () => {
    const parts: THREE.BufferGeometry[] = [];
    const prof = [0.16, 0.2, 0.22, 0.23, 0.22, 0.19, 0.15, 0.11];
    prof.forEach((w, i) => {
      const s = new THREE.SphereGeometry(1, 10, 8);
      s.scale(0.085, w * 0.62, w);
      s.translate(0.42 - i * 0.115, 0, 0);
      parts.push(s);
    });
    // tail fan
    const fan = new THREE.SphereGeometry(1, 8, 6);
    fan.scale(0.14, 0.02, 0.16);
    fan.translate(-0.5, 0, 0);
    parts.push(fan);
    // legs + antennae
    for (let i = 0; i < 6; i++)
      [1, -1].forEach((sd) => {
        const leg = new THREE.CylinderGeometry(0.012, 0.006, 0.26, 4);
        leg.translate(0, -0.13, 0);
        leg.rotateX(sd * -0.9);
        leg.rotateZ(-0.3 + i * 0.1);
        leg.translate(0.3 - i * 0.12, -0.05, sd * 0.14);
        parts.push(leg);
      });
    [1, -1].forEach((sd) => {
      const an = new THREE.CylinderGeometry(0.008, 0.004, 0.36, 4);
      an.translate(0, 0.18, 0);
      an.rotateZ(-1.2);
      an.rotateY(sd * -0.5);
      an.translate(0.48, 0.03, sd * 0.07);
      parts.push(an);
    });
    const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
    g.computeVertexNormals();
    const eyes = mergeGeometries(
      [1, -1].map((sd) => {
        const e = new THREE.SphereGeometry(0.06, 8, 6);
        e.translate(0.46, 0.07, sd * 0.11);
        return e;
      }),
    )!;
    return { body: g, eyes };
  });

const isoMats = () =>
  memo("isoMats", () => ({
    body: new THREE.MeshStandardMaterial({ color: "#e8d6b4", roughness: 0.35, emissive: C("#6b5332"), emissiveIntensity: 0.55 }),
    eyes: new THREE.MeshBasicMaterial({ color: "#d8ff5a", fog: false }),
  }));

export const Isopod: React.FC<Omit<React.ComponentProps<"group">, "children">> = (p) => {
  const g = isopodGeo();
  const m = isoMats();
  return (
    <group {...p}>
      <mesh geometry={g.body} material={m.body} />
      <mesh geometry={g.eyes} material={m.eyes} />
    </group>
  );
};

export type SwarmPose = (i: number, rnd: number[]) => { p: THREE.Vector3; dir: THREE.Vector3; s: number } | null;
/** many isopods; `pose` gives each one its place for the current frame */
export const Swarm: React.FC<{ count: number; seed?: number; pose: SwarmPose; glow?: number }> = ({ count, seed = 1, pose, glow = 1 }) => {
  const sys = useMemo(() => {
    const g = isopodGeo();
    const m = isoMats();
    const body = new THREE.InstancedMesh(g.body, m.body, count);
    const eyes = new THREE.InstancedMesh(g.eyes, m.eyes, count);
    body.frustumCulled = eyes.frustumCulled = false;
    const r = rng(seed * 101 + 9);
    const rnd = Array.from({ length: count }, () => [r(), r(), r(), r()]);
    const halo = new THREE.BufferGeometry();
    halo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return { body, eyes, rnd, halo };
  }, [count, seed]);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const X = V(1, 0, 0);
  const hp = sys.halo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < count; i++) {
    const o = pose(i, sys.rnd[i]);
    if (!o) {
      m4.makeScale(0, 0, 0);
      hp.setXYZ(i, 0, -999, 0);
    } else {
      q.setFromUnitVectors(X, o.dir.clone().normalize());
      m4.compose(o.p, q, V(o.s, o.s, o.s));
      hp.setXYZ(i, o.p.x + o.dir.x * o.s * 0.45, o.p.y + o.s * 0.07, o.p.z + o.dir.z * o.s * 0.45);
    }
    sys.body.setMatrixAt(i, m4);
    sys.eyes.setMatrixAt(i, m4);
  }
  sys.body.instanceMatrix.needsUpdate = true;
  sys.eyes.instanceMatrix.needsUpdate = true;
  hp.needsUpdate = true;
  return (
    <group>
      <primitive object={sys.body} />
      <primitive object={sys.eyes} />
      <points geometry={sys.halo} frustumCulled={false} renderOrder={9}>
        <pointsMaterial map={softSprite()} size={0.22} transparent opacity={0.5 * glow} depthWrite={false} blending={THREE.AdditiveBlending} color="#c8ff4a" fog={false} />
      </points>
    </group>
  );
};
