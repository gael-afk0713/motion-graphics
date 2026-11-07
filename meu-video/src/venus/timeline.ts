import { Easing, interpolate } from "remotion";
import * as THREE from "three";

// All values in absolute composition frames @30fps (16s = 480 frames).
export const FPS = 30;
export const DURATION = 16 * FPS;

export const CUT = {
  approachEnd: 2 * FPS, // 60
  spinEnd: 6 * FPS, // 180
  orbitEnd: 10 * FPS, // 300
  compareEnd: 13 * FPS, // 390
  retroEnd: 15 * FPS, // 450
};

export const SPIN_COUNTER = { start: 70, end: 170 }; // 0 -> 243 days
export const ORBIT = { start: 205, end: 292 }; // 0 -> 225 days, one full orbit

export const ORBIT_RADIUS = 30;
export const VENUS_RADIUS = 3;
const THETA0 = 0.9;

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const orbitProgress = (f: number) =>
  interpolate(f, [ORBIT.start, ORBIT.end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

export const orbitAngle = (f: number) =>
  THETA0 + orbitProgress(f) * Math.PI * 2 + Math.max(0, f - ORBIT.end) * 0.0035;

export const venusPosition = (f: number) => {
  const th = orbitAngle(f);
  return new THREE.Vector3(
    ORBIT_RADIUS * Math.cos(th),
    0,
    -ORBIT_RADIUS * Math.sin(th),
  );
};

// Spin speed (rad/frame). Negative = retrograde (clockwise seen from north).
const spinRate = (i: number) => {
  if (i >= ORBIT.start && i < ORBIT.end) {
    // While orbiting, rotate exactly 225/243 of a turn (physically consistent)
    return (
      (-Math.PI * 2 * (225 / 243)) * (orbitProgress(i + 1) - orbitProgress(i))
    );
  }
  if (i < CUT.spinEnd) return -0.0065;
  if (i < CUT.compareEnd) return -0.006;
  if (i < CUT.retroEnd) return -0.032;
  return -0.012;
};

const spinTable: number[] = [0];
for (let i = 0; i < DURATION + 2; i++) {
  spinTable.push(spinTable[i] + spinRate(i));
}
export const venusSpin = (f: number) =>
  spinTable[Math.max(0, Math.min(spinTable.length - 1, Math.floor(f)))];

// Local frame around Venus: s = towards Sun, t = orbital direction, y = north
const venusBasis = (f: number) => {
  const th = orbitAngle(f);
  const s = new THREE.Vector3(-Math.cos(th), 0, Math.sin(th));
  const t = new THREE.Vector3(-Math.sin(th), 0, -Math.cos(th));
  const y = new THREE.Vector3(0, 1, 0);
  return { s, t, y };
};

const dirFrom = (f: number, a: number, b: number, c: number) => {
  const { s, t, y } = venusBasis(f);
  return s
    .multiplyScalar(a)
    .add(t.multiplyScalar(b))
    .add(y.multiplyScalar(c))
    .normalize();
};

export const approachDirection = (f: number) => dirFrom(f, 0.55, 0.75, 0.16);

export const cameraState = (f: number) => {
  const V = venusPosition(f);

  // Scenes 1–2: fast fly-in, then a gentle drift
  const approachDist = interpolate(f, [0, 56, CUT.spinEnd], [330, 17.5, 16], {
    ...clamp,
    easing: Easing.bezier(0.3, 0.05, 0.15, 1),
  });
  const sway = interpolate(f, [0, CUT.spinEnd], [-0.06, 0.06], clamp);
  const dA = dirFrom(f, 0.55, 0.75 + sway, 0.16);
  const closePos = V.clone().add(dA.multiplyScalar(approachDist));
  const closeTarget = V.clone().add(new THREE.Vector3(0, 1.0, 0));

  // Scenes 3–4: wide orbit view from above
  const az = interpolate(f, [CUT.spinEnd, CUT.compareEnd], [0.15, -0.25], clamp);
  const el = (55 * Math.PI) / 180;
  const D = interpolate(f, [CUT.spinEnd, CUT.compareEnd], [150, 140], clamp);
  const globalPos = new THREE.Vector3(
    Math.sin(az) * Math.cos(el) * D,
    Math.sin(el) * D,
    Math.cos(az) * Math.cos(el) * D,
  );
  const globalTarget = new THREE.Vector3(0, 0, 0);

  // Scenes 5–6: elevated close-up, so the retrograde arrow reads clockwise
  const retroDist = interpolate(f, [CUT.compareEnd, CUT.retroEnd, DURATION], [22.5, 21, 25], clamp);
  const dB = dirFrom(f, 0.45, 0.5, 0.72);
  const retroPos = V.clone().add(dB.multiplyScalar(retroDist));
  const retroTarget = V.clone().add(
    new THREE.Vector3(0, interpolate(f, [CUT.retroEnd, DURATION], [0.2, 1.6], clamp), 0),
  );

  const kOut = interpolate(f, [CUT.spinEnd - 2, CUT.spinEnd + 46], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const kIn = interpolate(f, [CUT.compareEnd - 8, CUT.compareEnd + 10], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.7, 0, 0.25, 1),
  });

  const pos = closePos.clone().lerp(globalPos, kOut).lerp(retroPos, kIn);
  const target = closeTarget
    .clone()
    .lerp(globalTarget, kOut)
    .lerp(retroTarget, kIn);
  return { pos, target };
};
