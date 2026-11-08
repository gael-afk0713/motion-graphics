import React, { useMemo } from "react";
import * as THREE from "three";
import { getStageSkin } from "./textures";

// Upper stage of a rocket, in metres, built along +Y (engine at -Y, front at +Y).
// White cylinder with dark-grey details and a big dark engine bell. No logos, no flags.
// Origin = middle of the body.
type Props = { variant?: "modern" | "apollo"; envMap?: THREE.Texture | null; glow?: number };

const bell = (throat: number, exit: number, len: number, n = 40) => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // parabolic bell: fast flare near the throat
    const r = throat + (exit - throat) * Math.pow(t, 0.62);
    pts.push(new THREE.Vector2(r, -t * len));
  }
  return pts;
};

export const RocketStage: React.FC<Props> = ({ variant = "modern", envMap = null, glow = 0 }) => {
  const apollo = variant === "apollo";
  const R = apollo ? 3.3 : 1.83;
  const L = apollo ? 13.5 : 9.5;
  const mats = useMemo(() => {
    const skin = getStageSkin(variant);
    return {
      body: new THREE.MeshPhysicalMaterial({ map: skin, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, envMap, envMapIntensity: 1.4 }),
      dark: new THREE.MeshStandardMaterial({ color: "#2b2f35", roughness: 0.45, metalness: 0.6, envMap, envMapIntensity: 1.2 }),
      grey: new THREE.MeshStandardMaterial({ color: "#5d636b", roughness: 0.5, metalness: 0.5, envMap, envMapIntensity: 1.0 }),
      nozzleOut: new THREE.MeshStandardMaterial({ color: "#1f2124", roughness: 0.32, metalness: 0.9, envMap, envMapIntensity: 1.6, side: THREE.DoubleSide }),
      nozzleIn: new THREE.MeshStandardMaterial({ color: "#0d0e10", roughness: 0.6, metalness: 0.6, side: THREE.BackSide, emissive: new THREE.Color("#ff6a20"), emissiveIntensity: 0 }),
      copper: new THREE.MeshStandardMaterial({ color: "#6b4a36", roughness: 0.35, metalness: 0.9, envMap, envMapIntensity: 1.3 }),
    };
  }, [variant, envMap]);
  mats.nozzleIn.emissiveIntensity = glow;

  const nozzle = useMemo(() => {
    const p = apollo ? bell(0.35, 1.0, 2.2) : bell(0.42, 1.65, 4.2);
    return new THREE.LatheGeometry(p, 64);
  }, [apollo]);

  const nozLen = apollo ? 2.2 : 4.2;
  const thrusters = apollo ? [] : [0, 1, 2, 3].map((k) => (k / 4) * Math.PI * 2 + Math.PI / 4);
  return (
    <group>
      {/* main tank */}
      <mesh castShadow receiveShadow material={mats.body}>
        <cylinderGeometry args={[R, R, L, 96, 1, true]} />
      </mesh>
      {/* forward end: payload adapter (dark grey frustum) + ring */}
      <mesh position={[0, L / 2 + 0.55, 0]} castShadow receiveShadow material={mats.dark}>
        <cylinderGeometry args={[R * 0.62, R, 1.1, 64]} />
      </mesh>
      <mesh position={[0, L / 2 + 1.25, 0]} castShadow material={mats.grey}>
        <cylinderGeometry args={[R * 0.55, R * 0.62, 0.3, 48]} />
      </mesh>
      <mesh position={[0, L / 2 + 0.02, 0]} castShadow material={mats.grey}>
        <torusGeometry args={[R + 0.02, 0.07, 8, 96]} />
      </mesh>
      {/* aft dome + engine section */}
      <mesh position={[0, -L / 2, 0]} castShadow receiveShadow material={mats.dark}>
        <cylinderGeometry args={[R, R * 0.92, 0.5, 64]} />
      </mesh>
      <mesh position={[0, -L / 2 - 0.25, 0]} rotation={[Math.PI, 0, 0]} castShadow material={mats.grey}>
        <sphereGeometry args={[R * 0.92, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* turbopump / thrust structure (copper-ish dark metal) */}
      <mesh position={[0, -L / 2 - 1.3, 0]} castShadow material={mats.copper}>
        <cylinderGeometry args={[0.55, 0.8, 1.4, 24]} />
      </mesh>
      <mesh position={[0.75, -L / 2 - 1.4, 0.3]} castShadow material={mats.dark}>
        <cylinderGeometry args={[0.28, 0.28, 1.2, 16]} />
      </mesh>
      {/* the big engine bell */}
      <group position={[0, -L / 2 - 1.95, 0]}>
        <mesh geometry={nozzle} material={mats.nozzleOut} castShadow />
        <mesh geometry={nozzle} material={mats.nozzleIn} scale={[0.985, 1, 0.985]} />
        <mesh position={[0, -nozLen, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.grey}>
          <torusGeometry args={[apollo ? 1.0 : 1.65, 0.05, 6, 96]} />
        </mesh>
        {/* cooling bands on the bell */}
        {[0.25, 0.5, 0.75].map((t) => (
          <mesh key={t} position={[0, -nozLen * t, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.dark}>
            <torusGeometry args={[(apollo ? 0.35 : 0.42) + ((apollo ? 1.0 : 1.65) - (apollo ? 0.35 : 0.42)) * Math.pow(t, 0.62) + 0.01, 0.025, 6, 96]} />
          </mesh>
        ))}
      </group>
      {/* RCS thruster pods near the front */}
      {thrusters.map((a) => (
        <group key={a} position={[Math.cos(a) * (R + 0.12), L / 2 - 0.8, Math.sin(a) * (R + 0.12)]} rotation={[0, -a, 0]}>
          <mesh castShadow material={mats.dark}>
            <boxGeometry args={[0.3, 0.7, 0.5]} />
          </mesh>
        </group>
      ))}
      {/* helium bottle fairings along the side */}
      {!apollo &&
        [0.4, 3.6].map((a) => (
          <mesh key={a} position={[Math.cos(a) * (R + 0.05), -L * 0.15, Math.sin(a) * (R + 0.05)]} castShadow material={mats.grey}>
            <capsuleGeometry args={[0.22, 2.6, 6, 12]} />
          </mesh>
        ))}
      {apollo && (
        <mesh position={[0, -L / 2 + 0.3, 0]} castShadow material={mats.dark}>
          <cylinderGeometry args={[R * 1.02, R * 1.02, 0.6, 64, 1, true]} />
        </mesh>
      )}
    </group>
  );
};
