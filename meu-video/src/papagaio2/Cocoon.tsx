// The mucus cocoon ("saco de baba"), matched to real dive photos: NOT a smooth soap bubble. A thin film,
// clear to slightly milky (white-grey), irregular and wrinkled, with threads and specks of particles
// caught in it; a loose bag that follows the body with room to spare and is stuck to the bottom. Only a
// soft moonlit sheen on the edges. Lives in the fish's local space (+x = snout): put it inside the
// same group/position as the Fish.
import React, { useMemo } from "react";
import * as THREE from "three";
import { fbm3, memo } from "../papagaio/gfx";

/** bottom of the bag in fish space (the fish rests on the sand: belly at about -0.36) */
export const BAG_FLOOR = -0.41;
const CX = -0.14; // centre of the bag along the body
const RX = 1.38;
const RY = 0.5;
const RZ = 0.39;
/** x where the film starts (snout end) and ends (tail end): the reveal runs from one to the other */
export const BAG_FRONT = CX + RX + 0.02;
export const BAG_BACK = CX - RX - 0.02;

const bagGeometry = () =>
  memo("cocoonBag", () => {
    const g = new THREE.SphereGeometry(1, 120, 72);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      // loose, lumpy bag: low-frequency bulges + a sag on top
      const n1 = fbm3(x * 1.6 + 3, y * 1.6, z * 1.6);
      const n2 = fbm3(x * 4.5, y * 4.5 + 7, z * 4.5);
      const k = 1 + 0.12 * (n1 - 0.5) + 0.045 * (n2 - 0.5);
      let X = CX + x * RX * k;
      let Y = y * RY * k - 0.02;
      const Z = z * RZ * k * (1 + 0.12 * Math.max(0, -y)); // wider at the bottom, it slumps
      // the tail end narrows a little (follows the body), the head end stays round
      if (x < -0.4) Y *= 1 - 0.18 * (-x - 0.4);
      // stuck to the bottom: the lower part is pressed flat on the sand
      if (Y < BAG_FLOOR) Y = BAG_FLOOR + (Y - BAG_FLOOR) * 0.04;
      X += 0.03 * Math.sin(y * 9 + z * 4);
      p.setXYZ(i, X, Y, Z);
    }
    g.computeVertexNormals();
    return g;
  });

const NOISE = /* glsl */ `
  float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float ridge(vec3 x){ return 1.0 - abs(2.0 * vnoise(x) - 1.0); }
`;

export const MAX_HITS = 6;

const makeMat = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uEdge: { value: BAG_BACK },
      uTime: { value: 0 },
      uDeflate: { value: 0 },
      uTear: { value: 0 },
      uNight: { value: 1 },
      uAlpha: { value: 1 },
      uHit: { value: Array.from({ length: MAX_HITS }, () => new THREE.Vector3()) },
      uHitK: { value: Array.from({ length: MAX_HITS }, () => -1) },
    },
    vertexShader: /* glsl */ `
      uniform float uDeflate; uniform float uTime;
      varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      ${NOISE}
      void main(){
        vP = position;
        vec3 p = position;
        // slow breathing of the film in the current
        p += normal * 0.012 * sin(position.x * 6.0 + uTime * 1.3) * sin(position.y * 9.0 + uTime * 0.9);
        // deflated (empty, slumped on the sand): flatter, wider, more folds
        float fl = ${"-0.41"};
        p.y = mix(p.y, fl + (p.y - fl) * 0.2, uDeflate);
        p.xz *= 1.0 + 0.16 * uDeflate;
        p += normal * uDeflate * 0.05 * (vnoise(position * 7.0) - 0.5);
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uEdge; uniform float uTime; uniform float uDeflate; uniform float uTear; uniform float uNight; uniform float uAlpha;
      uniform vec3 uHit[${MAX_HITS}]; uniform float uHitK[${MAX_HITS}];
      varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      ${NOISE}
      void main(){
        // grows from the mouth (snout end) towards the tail; a ragged front
        float front = vP.x - uEdge + 0.06 * (vnoise(vP * 9.0) - 0.5);
        if (front < 0.0) discard;
        // torn open at the snout end once the fish pushes out
        float hole = uTear * 0.55 - length((vP.yz - vec2(-0.08, 0.0)) * vec2(1.0, 0.8)) + 0.12 * (vnoise(vP * 11.0) - 0.5);
        if (uTear > 0.0 && vP.x > 0.75 && hole > 0.0) discard;

        // wrinkles and folds: ridged noise stretched along the body + finer crinkles
        float w1 = pow(ridge(vP * vec3(2.6, 8.0, 8.0) + vec3(0.0, 0.0, uTime * 0.03)), 5.0);
        float w2 = pow(ridge(vP * vec3(7.0, 19.0, 19.0) + 4.0), 7.0);
        float w3 = pow(ridge(vP * vec3(15.0, 30.0, 30.0) + 9.0), 9.0);
        float wr = w1 * 0.75 + w2 * 0.55 + w3 * 0.3 + uDeflate * 0.4 * w2;
        // bumped normal from the wrinkle height
        vec3 N = normalize(vN);
        vec3 dpx = dFdx(vW); vec3 dpy = dFdy(vW);
        float hx = dFdx(wr); float hy = dFdy(wr);
        vec3 r1 = cross(dpy, N); vec3 r2 = cross(N, dpx);
        float det = dot(dpx, r1);
        vec3 grad = (hx * r1 + hy * r2) / (abs(det) + 1e-6) * sign(det);
        vec3 Nb = normalize(N - grad * 0.035);
        vec3 V = normalize(vV);
        float fres = pow(1.0 - abs(dot(Nb, V)), 2.2);

        // threads (long thin strands) and specks of particles caught in the film
        float th = smoothstep(0.965, 0.995, ridge(vec3(vP.x * 1.3 + vP.z * 2.0, vP.y * 26.0 + vP.z * 13.0, vP.z * 2.0 + 5.0)));
        th *= smoothstep(0.35, 0.7, vnoise(vP * 3.0 + 2.0));
        vec3 c = vP * 46.0; vec3 cf = fract(c) - 0.5;
        float hs = hash3(floor(c));
        float speck = step(0.982, hs) * smoothstep(0.32, 0.05, length(cf));
        float dark = step(0.992, hash3(floor(c) + 7.0)) * smoothstep(0.3, 0.05, length(cf));

        // moon from above + a little fill; soft sheen only near the edges
        vec3 L = normalize(vec3(0.15, 1.0, 0.35));
        float lam = 0.55 + 0.45 * max(dot(Nb, L), 0.0);
        vec3 milk = mix(vec3(0.86, 0.85, 0.80), vec3(0.74, 0.80, 0.86), uNight);
        vec3 col = milk * lam * mix(1.0, 0.8, uNight);
        col += mix(vec3(1.0, 0.97, 0.9), vec3(0.72, 0.84, 1.0), uNight) * pow(fres, 3.0) * 0.55;
        col += vec3(1.0) * pow(max(dot(reflect(-L, Nb), V), 0.0), 30.0) * 0.18;
        col = mix(col, vec3(0.95, 0.94, 0.9), th * 0.6);
        col = mix(col, vec3(0.97), speck * 0.8);
        col = mix(col, vec3(0.3, 0.28, 0.24), dark * 0.8);

        float a = 0.07 + 0.32 * fres + 0.36 * wr + 0.4 * th + 0.75 * speck + 0.7 * dark;
        // thicker, milkier rim where the film is still spreading
        float growing = step(${(BAG_BACK + 0.05).toFixed(3)}, uEdge);
        a += growing * 0.45 * smoothstep(0.14, 0.0, front);
        col = mix(col, vec3(0.93, 0.93, 0.9), growing * 0.6 * smoothstep(0.14, 0.0, front));
        // bottom, where it is glued to the sand: denser, catches sand
        a += 0.25 * smoothstep(-0.3, -0.4, vP.y);
        a += uDeflate * 0.12;

        // glints where a parasite bumps the film: a flash + a ripple ring
        for (int i = 0; i < ${MAX_HITS}; i++) {
          float k = uHitK[i];
          if (k < 0.0 || k > 1.0) continue;
          float d = distance(vP, uHit[i]);
          float ring = exp(-pow((d - 0.42 * k) / 0.05, 2.0)) * (1.0 - k) * 1.4;
          float flash = exp(-d * d / 0.018) * (1.0 - k) * 1.8;
          col += vec3(0.85, 1.0, 1.0) * (ring * 0.8 + flash);
          a += ring * 0.45 + flash * 0.6;
        }
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.92) * uAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

export type Hit = { p: THREE.Vector3; k: number };

/**
 * cover: 0 = nothing, 1 = closed bag (the film spreads from the mouth to the tail)
 * deflate: 0 = full, 1 = empty and slumped; tear: 0..1 hole at the snout end
 */
export const Cocoon: React.FC<{
  t: number;
  cover?: number;
  deflate?: number;
  tear?: number;
  night?: number;
  alpha?: number;
  hits?: Hit[];
}> = ({ t, cover = 1, deflate = 0, tear = 0, night = 1, alpha = 1, hits = [] }) => {
  const mat = useMemo(makeMat, []);
  if (cover <= 0.001) return null;
  const u = mat.uniforms;
  u.uEdge.value = BAG_FRONT + (BAG_BACK - BAG_FRONT) * Math.min(1, cover);
  u.uTime.value = t;
  u.uDeflate.value = deflate;
  u.uTear.value = tear;
  u.uNight.value = night;
  u.uAlpha.value = alpha;
  for (let i = 0; i < MAX_HITS; i++) {
    const h = hits[i];
    (u.uHit.value as THREE.Vector3[])[i].copy(h ? h.p : new THREE.Vector3());
    (u.uHitK.value as number[])[i] = h ? h.k : -1;
  }
  return <mesh geometry={bagGeometry()} material={mat} renderOrder={20} />;
};

/** a point on the outside of the bag in the direction (x, y, z) of fish space, and its outward normal */
export const bagPoint = (x: number, y: number, z: number) => {
  const d = new THREE.Vector3((x - CX) / RX, y / RY, z / RZ).normalize();
  const p = new THREE.Vector3(CX + d.x * RX, d.y * RY, d.z * RZ);
  const n = new THREE.Vector3(d.x / RX, d.y / RY, d.z / RZ).normalize();
  return { p, n };
};

/** milky blobs of slime oozing out of the mouth (scene 2) */
const blobMat = () =>
  memo("slimeBlob", () => new THREE.MeshPhysicalMaterial({ color: "#e4e6e2", transparent: true, opacity: 0.42, roughness: 0.25, depthWrite: false, emissive: "#55606a", emissiveIntensity: 0.25 }));
export const SlimeOoze: React.FC<{ k: number }> = ({ k }) => {
  // k: frames since the slime started; blobs leave the mouth, slide back over the head and flatten
  const blobs = [0, 1, 2, 3, 4, 5, 6];
  return (
    <group>
      {blobs.map((i) => {
        const age = k - i * 5;
        if (age < 0) return null;
        const s = Math.min(1, age / 8);
        const back = Math.min(0.75, age * 0.016);
        const up = Math.sin(Math.min(Math.PI / 2, age * 0.05)) * (0.12 + 0.03 * (i % 3));
        const side = (i % 2 ? 1 : -1) * (0.05 + 0.04 * (i % 3)) * Math.min(1, age / 20);
        return (
          <mesh
            key={i}
            material={blobMat()}
            position={[1.02 - back, -0.08 + up * Math.min(1, back * 3), side]}
            scale={[0.06 * s * (1 + back), 0.035 * s, 0.05 * s * (1 + back * 0.6)]}
            renderOrder={19}
          >
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
        );
      })}
    </group>
  );
};
