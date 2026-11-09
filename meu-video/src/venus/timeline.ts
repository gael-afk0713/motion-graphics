import { Easing, interpolate } from "remotion";
import * as THREE from "three";
import { segmentEnd, spokenFrame } from "./captions";

// All values in absolute composition frames @30fps.
export const FPS = 30;

// Narration per scene, measured with ffmpeg silencedetect (adaptive loudnorm
// threshold). Times are seconds inside each mp3:
//  start/end = first/last speech, pause = the mid-sentence pause (>= 0.2s)
//  that splits the on-screen text in two parts.
export const NARRATION = [
  { file: "cena1.mp3", start: 0.062, end: 2.563, pause: [1.229, 1.497] },
  { file: "cena2.mp3", start: 0.024, end: 4.939, pause: [2.89, 3.155] },
  { file: "cena3.mp3", start: 0.035, end: 3.2, pause: null },
  { file: "cena4.mp3", start: 0.034, end: 3.989, pause: [0.618, 1.001] },
  { file: "cena5.mp3", start: 0.042, end: 3.833, pause: [0.868, 1.249] },
  { file: "cena6.mp3", start: 0.054, end: 1.763, pause: null },
] as const;

export const TAIL_SECONDS = 0.3; // breathing room after each line
export const TEXT_LEAD_FRAMES = 3; // text pops in this many frames before the voice

// Audio is trimmed at a frame boundary just before the speech starts
export const trimFrames = (i: number) => Math.floor(NARRATION[i].start * FPS);

// Scene length = speech length + 0.3s
export const SCENE_DURATIONS = NARRATION.map(
  (n) => Math.ceil((n.end - n.start) * FPS) + Math.round(TAIL_SECONDS * FPS),
);
export const SCENE_STARTS = SCENE_DURATIONS.map((_, i) =>
  SCENE_DURATIONS.slice(0, i).reduce((a, b) => a + b, 0),
);
export const DURATION = SCENE_DURATIONS.reduce((a, b) => a + b, 0);

// Frames from scene start to the moment `fileSec` of that scene's mp3
export const speechOffset = (i: number, fileSec: number) =>
  Math.round(fileSec * FPS) - trimFrames(i);

// Absolute frame of the moment `fileSec` in scene `i`'s mp3
export const beat = (i: number, fileSec: number) =>
  SCENE_STARTS[i] + speechOffset(i, fileSec);


export const CUT = {
  approachEnd: SCENE_STARTS[1],
  spinEnd: SCENE_STARTS[2],
  orbitEnd: SCENE_STARTS[3],
  compareEnd: SCENE_STARTS[4],
  retroEnd: SCENE_STARTS[5],
};

// Counter 0 -> 243 while "Vênus leva 243 dias" is spoken
export const SPIN_COUNTER = { start: spokenFrame("spin", "243"), end: spokenFrame("spin", "DIAS") };
// One full orbit (0 -> 225 days) across the scene-3 line, landing on "Sol"
export const ORBIT = { start: spokenFrame("orbit", "225"), end: segmentEnd("orbit", 0) };
// Retrograde arrow appears with the first phrase of scene 5
export const RETRO_ARROW_START = beat(4, NARRATION[4].start) - TEXT_LEAD_FRAMES;

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
  const approachDist = interpolate(f, [0, 52, CUT.spinEnd], [330, 17.5, 16], {
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

  const kOut = interpolate(f, [CUT.spinEnd - 2, CUT.spinEnd + 34], [0, 1], {
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

// What plays before the standard Curiosário ending: scenes 1-5. The CTA scene
// ("Segue pra mais curiosidades") is dropped — the ending replaces it. The cut
// is 8 frames before scene 6, i.e. right after "...nasce no OESTE" is spoken
// and before the flash/fade transition into the CTA starts.
export const CONTENT_DURATION = SCENE_STARTS[5] - 8;
