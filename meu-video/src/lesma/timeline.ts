// "Lesma" — timing derived from the narration (audio is already sped up and
// trimmed: it is used as-is, no speed change, no trimming).
export const FPS = 30;
export const TAIL = 0.15; // seconds of breathing room after each line

// Speech stretches inside each mp3, measured with ffmpeg silencedetect
// (adaptive loudnorm threshold, pauses >= 0.08s). Seconds.
export const NARRATION = [
  { file: "lesma/lesma1.mp3", dur: 2.664, segs: [[0, 1.975], [2.059, 2.664]] },
  { file: "lesma/lesma2.mp3", dur: 3.056, segs: [[0, 1.208], [1.501, 2.931], [3.015, 3.056]] },
  { file: "lesma/lesma3.mp3", dur: 4.127, segs: [[0, 2.31], [2.597, 3.081], [3.198, 3.794], [3.898, 4.127]] },
  { file: "lesma/lesma4.mp3", dur: 5.146, segs: [[0, 1.474], [1.876, 3.283], [3.524, 5.146]] },
  { file: "lesma/lesma5.mp3", dur: 3.004, segs: [[0, 3.004]] },
  { file: "lesma/lesma6.mp3", dur: 6.087, segs: [[0, 0.947], [1.411, 3.043], [3.133, 6.087]] },
  { file: "lesma/lesma7.mp3", dur: 3.056, segs: [[0, 0.914], [1.021, 2.181], [2.505, 2.943], [3.023, 3.056]] },
] as const;

export const SCENE_DURATIONS = NARRATION.map((n) => Math.ceil((n.dur + TAIL) * FPS));
export const SCENE_STARTS = SCENE_DURATIONS.map((_, i) =>
  SCENE_DURATIONS.slice(0, i).reduce((a, b) => a + b, 0),
);
export const DURATION = SCENE_DURATIONS.reduce((a, b) => a + b, 0);
export const S = SCENE_STARTS; // shorthand
export const sceneEnd = (i: number) => SCENE_STARTS[i] + SCENE_DURATIONS[i];
/** Absolute frame of second `sec` of scene i's narration */
export const at = (i: number, sec: number) => SCENE_STARTS[i] + Math.round(sec * FPS);
