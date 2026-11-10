// "Peixe-papagaio – parte 1/3": every scene lasts exactly its narration file (+4 frames)
import { NARRATION } from "./words";

export const FPS = 30;
export const TAIL_FRAMES = 4;

export const SCENE_DURATIONS = NARRATION.map((n) => Math.ceil(n.dur * FPS) + TAIL_FRAMES);
export const S = SCENE_DURATIONS.map((_, i) =>
  SCENE_DURATIONS.slice(0, i).reduce((a, b) => a + b, 0),
);
export const DURATION = SCENE_DURATIONS.reduce((a, b) => a + b, 0);
export const sceneEnd = (i: number) => S[i] + SCENE_DURATIONS[i];
export const at = (i: number, sec: number) => S[i] + Math.round(sec * FPS);
export const sceneOf = (f: number) => {
  for (let i = S.length - 1; i >= 0; i--) if (f >= S[i]) return i;
  return 0;
};

/** start (absolute frame) of the n-th caption word of scene i (0-based) */
export const word = (i: number, n: number) => at(i, NARRATION[i].t[n]);

// ---------------------------------------------------------------------------
// Cues (absolute frames), all taken from the spoken words
// ---------------------------------------------------------------------------
// scene 1
export const C1_SAND = word(0, 5) - 3; // "E o seu cocô": cut to the sand cloud
export const C1_RISE = word(0, 9) - 4; // "constrói": the camera shoots up
export const C1_ISLAND = C1_RISE + 9; // through the surface: the islet from above (3.5 s)
// scene 2
export const C2_GROW = word(1, 6) + 2; // "e nunca param de crescer"
export const C2_BITE_CUT = word(1, 11) - 2; // "Essa é a sua..."
export const C2_BITE = word(1, 15) + 2; // "picareta": the beak hits the coral
// scene 3
export const C3_B = S[2] + 62; // second angle on the scraping
export const C3_STONE = word(2, 11) - 2; // "Mas coral é pedra": hard cut
export const C3_CLANK = C3_STONE + 6; // freeze frame with the clank
export const FREEZE = 9; // 0.3 s
// scene 4
export const C4_MILL = S[3] + 76; // "dentro da garganta": close on the mill
export const C4_GRIND = word(3, 12); // "que mói tudo"
export const C4_WIDE = word(3, 15) - 2; // "Esse é o seu..."
export const C4_LABEL = word(3, 19); // "moedor"
// scene 5
export const C5_GLOBE = word(4, 7) - 3; // "Nas Maldivas"
export const C5_PIN = word(4, 8) + 10;
export const C5_85 = word(4, 9) - 2; // "mais de 85%"
export const C5_COUNT = word(4, 11) - 2;
export const C5_SCHOOL = word(4, 17) - 2; // "vem de peixes como você"
export const C5_AERIAL = word(4, 22) - 3; // "E as ondas levam..."
export const C5_FACTORY = word(4, 31) - 3; // "Essa é a sua..."
export const C5_LABEL = word(4, 35); // "fábrica de ilhas"
// scene 6
export const C6_SWARM = word(5, 2) - 3; // "E saem parasitas"
export const C6_BLOOD = word(5, 6) - 2; // "que sugam sangue"
export const C6_DROP = word(5, 8); // "sangue"
export const C6_AROUND = word(5, 9) - 3; // "Os mosquitos do mar"
// scene 7
export const C7_B = S[6] + 52;
export const C7_NIGHT = word(6, 8) - 3; // "Mas à noite..."
// scene 8
export const C8_A = word(7, 4); // "A:"
export const C8_B = word(7, 15); // "B:"
// scene 9
export const C9_WARN = word(8, 10); // "sobrevive à noite"

// hard cuts / whips inside the video (for whooshes and the camera layer)
export const WHIPS = [C1_RISE, S[1], C2_BITE_CUT, S[2], S[3], C4_MILL, S[4], C5_GLOBE, C5_85, C5_AERIAL, S[5], C6_SWARM, S[6], C7_NIGHT, S[7]];
