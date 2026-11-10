// Globe that spins and zooms into the Indian Ocean, with a yellow pin on the Maldives.
import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { V } from "./gfx";

// NASA Blue Marble (public domain), already in the project
let earth: THREE.Texture | null = null;
let pending: Promise<void> | null = null;
const loadAll = () => {
  pending ??= Promise.all([
    new Promise<THREE.Texture>((res, rej) =>
      new THREE.TextureLoader().load(staticFile("foguete/tex/earth_bluemarble_clouds.jpg"), res, undefined, rej),
    ),
    // canvas textures with letters (the "z" bubbles) need the caption font
    document.fonts.load("900 78px Montserrat"),
  ]).then(([t]) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    earth = t;
  });
  return pending;
};
export const useAssets = () => {
  const [ok, setOk] = useState(earth !== null);
  const [handle] = useState(() => (earth ? null : delayRender("papagaio assets")));
  useEffect(() => {
    if (earth) return;
    loadAll().then(() => {
      setOk(true);
      if (handle !== null) continueRender(handle);
    });
  }, [handle]);
  return ok;
};

const LAT = (3.2 * Math.PI) / 180;
const LON = (73.2 * Math.PI) / 180;
export const GLOBE_R = 5;

/** spin: 0 = far side still turning, 1 = Maldives facing the camera (+z) */
export const GlobeSet: React.FC<{ spin: number; pin: number; t: number }> = ({ spin, pin, t }) => {
  const mats = useMemo(
    () => ({
      earth: new THREE.MeshStandardMaterial({ map: earth, roughness: 0.75 }),
      air: new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5); gl_FragColor = vec4(0.35, 0.8, 1.0, f * 0.9); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      pin: new THREE.MeshStandardMaterial({ color: "#FFD23F", emissive: new THREE.Color("#FFD23F"), emissiveIntensity: 0.6, roughness: 0.4 }),
      dark: new THREE.MeshBasicMaterial({ color: "#0b1c22", side: THREE.BackSide }),
    }),
    [],
  );
  const rotY = -Math.PI / 2 - LON - (1 - spin) * 3.4;
  const n = V(Math.cos(LAT) * Math.cos(LON), Math.sin(LAT), -Math.cos(LAT) * Math.sin(LON));
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
  const s = 1.7 * pin * (1 + 0.08 * Math.sin(t * 8));
  return (
    <group>
      <color attach="background" args={["#04163a"]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 5, 10]} intensity={2.2} />
      <group rotation={[0.12 * (1 - spin), rotY, 0]}>
        <mesh material={mats.earth}>
          <sphereGeometry args={[GLOBE_R, 64, 48]} />
        </mesh>
        <mesh material={mats.air} scale={1.03}>
          <sphereGeometry args={[GLOBE_R, 48, 32]} />
        </mesh>
        {pin > 0.01 && (
          <group position={n.clone().multiplyScalar(GLOBE_R)} quaternion={q} scale={s}>
            <mesh material={mats.dark} position={[0, 0.3, 0]} rotation={[Math.PI, 0, 0]} scale={1.12}>
              <coneGeometry args={[0.2, 0.62, 20]} />
            </mesh>
            <mesh material={mats.pin} position={[0, 0.3, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.18, 0.6, 20]} />
            </mesh>
            <mesh material={mats.dark} position={[0, 0.66, 0]} scale={1.08}>
              <sphereGeometry args={[0.27, 20, 14]} />
            </mesh>
            <mesh material={mats.pin} position={[0, 0.66, 0]}>
              <sphereGeometry args={[0.26, 20, 14]} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};
