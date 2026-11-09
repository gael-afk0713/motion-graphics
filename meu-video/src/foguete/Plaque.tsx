import React, { useMemo } from "react";
import * as THREE from "three";
import { rng } from "./textures";

// Brushed-steel plaque on a short post (in the spirit of the Apollo 11 plaque):
// screws in the corners, letters engraved in low relief (normal map), no logos.
export const PLAQUE_W = 1.6;
export const PLAQUE_H = 0.9;
export const POST_H = 0.9; // bottom edge of the plate above the ground
export const PLAQUE_TILT = 0.2; // leans back a little (radians)

const TW = 2048;
const TH = Math.round((TW * PLAQUE_H) / PLAQUE_W);
const L1 = "SE VOCÊ GOSTA DE CURIOSIDADES COMO ESSA";
const WORDS = ["CURTA", "SIGA", "COMPARTILHE"];
const SEP = "  •  ";
const L3 = "CURIOSÁRIO";
const FONT = "Montserrat";

type Layout = {
  f1: number;
  f2: number;
  f3: number;
  y1: number;
  y2: number;
  y3: number;
  wordX: number[];
};

const layout = (g: CanvasRenderingContext2D): Layout => {
  const fit = (text: string, weight: number, max: number, start: number) => {
    let f = start;
    g.font = `${weight} ${f}px ${FONT}`;
    while (g.measureText(text).width > max && f > 10) {
      f -= 2;
      g.font = `${weight} ${f}px ${FONT}`;
    }
    return f;
  };
  const f1 = fit(L1, 700, TW * 0.8, 80);
  const f2 = fit(WORDS.join(SEP), 800, TW * 0.82, 170);
  const f3 = fit(L3, 600, TW * 0.3, 60);
  g.font = `800 ${f2}px ${FONT}`;
  const full = g.measureText(WORDS.join(SEP)).width;
  let x = TW / 2 - full / 2;
  const wordX: number[] = [];
  WORDS.forEach((w, i) => {
    wordX.push(x);
    x +=
      g.measureText(w).width +
      (i < WORDS.length - 1 ? g.measureText(SEP).width : 0);
  });
  return { f1, f2, f3, y1: TH * 0.3, y2: TH * 0.56, y3: TH * 0.8, wordX };
};

// draw the text (or one highlighted word) into a context
const drawText = (g: CanvasRenderingContext2D, L: Layout, only?: number) => {
  g.textBaseline = "middle";
  if (only === undefined) {
    g.textAlign = "center";
    g.font = `700 ${L.f1}px ${FONT}`;
    g.fillText(L1, TW / 2, L.y1);
    g.font = `600 ${L.f3}px ${FONT}`;
    g.fillText(L3.split("").join(String.fromCharCode(8202)), TW / 2, L.y3);
  }
  g.textAlign = "left";
  g.font = `800 ${L.f2}px ${FONT}`;
  WORDS.forEach((w, i) => {
    if (only === undefined || only === i) g.fillText(w, L.wordX[i], L.y2);
  });
  if (only === undefined) {
    for (let i = 0; i < WORDS.length - 1; i++)
      g.fillText(SEP, L.wordX[i] + g.measureText(WORDS[i]).width, L.y2);
  }
};

let cache: {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  glow: THREE.CanvasTexture[];
} | null = null;
const getPlaqueTextures = () => {
  if (cache) return cache;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = TW;
    c.height = TH;
    return c;
  };
  // --- engraving mask (white = cut into the steel)
  const mc = mk();
  const mg = mc.getContext("2d")!;
  const L = layout(mg);
  mg.fillStyle = "#000";
  mg.fillRect(0, 0, TW, TH);
  mg.fillStyle = "#fff";
  drawText(mg, L);
  // engraved border line
  mg.strokeStyle = "#fff";
  mg.lineWidth = 7;
  mg.strokeRect(TW * 0.045, TH * 0.08, TW * 0.91, TH * 0.84);
  const mask = mg.getImageData(0, 0, TW, TH).data;

  // --- colour: brushed steel + darker engraved grooves + screws
  const cc = mk();
  const g = cc.getContext("2d")!;
  const img = g.createImageData(TW, TH);
  const r = rng(2024);
  const streak = new Float32Array(TH);
  for (let y = 0; y < TH; y++) streak[y] = (r() - 0.5) * 0.08;
  for (let y = 0; y < TH; y++) {
    let run = 0;
    for (let x = 0; x < TW; x++) {
      if ((x & 63) === 0) run = (r() - 0.5) * 0.05;
      const i = (y * TW + x) * 4;
      const m = mask[i] / 255;
      const base = 0.74 + streak[y] + run + (r() - 0.5) * 0.04;
      const v = base * (1 - 0.55 * m);
      img.data[i] = v * 236;
      img.data[i + 1] = v * 238;
      img.data[i + 2] = v * 242;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // screws
  const screws = [
    [TW * 0.022, TH * 0.04],
    [TW * 0.978, TH * 0.04],
    [TW * 0.022, TH * 0.96],
    [TW * 0.978, TH * 0.96],
  ];
  for (const [x, y] of screws) {
    const gr = g.createRadialGradient(x - 6, y - 6, 2, x, y, 26);
    gr.addColorStop(0, "#f2f3f5");
    gr.addColorStop(0.6, "#9a9ea4");
    gr.addColorStop(1, "#4a4d52");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, 24, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#3a3c40";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x - 15, y - 6);
    g.lineTo(x + 15, y + 6);
    g.stroke();
  }

  // --- normal map: grooves = depressions (blurred mask as height)
  const bc = mk();
  const bg = bc.getContext("2d")!;
  bg.filter = "blur(3px)";
  bg.drawImage(mc, 0, 0);
  const hb = bg.getImageData(0, 0, TW, TH).data;
  const nc = mk();
  const ng = nc.getContext("2d")!;
  const nimg = ng.createImageData(TW, TH);
  const H = (x: number, y: number) =>
    -hb[
      (Math.min(TH - 1, Math.max(0, y)) * TW +
        Math.min(TW - 1, Math.max(0, x))) *
        4
    ] / 255;
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 4;
      const dy = (H(x, y + 1) - H(x, y - 1)) * 4;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * TW + x) * 4;
      nimg.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  ng.putImageData(nimg, 0, 0);

  // --- one emissive mask per highlighted word
  const glow = WORDS.map((_, wi) => {
    const ec = mk();
    const eg = ec.getContext("2d")!;
    eg.fillStyle = "#000";
    eg.fillRect(0, 0, TW, TH);
    eg.fillStyle = "#fff";
    eg.shadowColor = "#fff";
    eg.shadowBlur = 30;
    drawText(eg, L, wi);
    const t = new THREE.CanvasTexture(ec);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

  const map = new THREE.CanvasTexture(cc);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const normal = new THREE.CanvasTexture(nc);
  normal.anisotropy = 8;
  cache = { map, normal, glow };
  return cache;
};

export const Plaque: React.FC<{
  envMap: THREE.Texture;
  word: number;
  glow: number;
}> = ({ envMap, word, glow }) => {
  const tex = getPlaqueTextures();
  const steel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c9ccd1",
        metalness: 0.75,
        roughness: 0.38,
        envMap,
        envMapIntensity: 1.1,
      }),
    [envMap],
  );
  const face = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: tex.map,
        normalMap: tex.normal,
        normalScale: new THREE.Vector2(1.6, 1.6),
        metalness: 0.6,
        roughness: 0.34,
        envMap,
        envMapIntensity: 1.2,
        emissive: new THREE.Color("#FFD23F"),
        emissiveIntensity: 0,
      }),
    [tex, envMap],
  );
  face.emissiveMap = word >= 0 ? tex.glow[word] : null;
  face.emissiveIntensity = word >= 0 ? glow : 0;
  face.needsUpdate = true;
  // BoxGeometry faces: +x, -x, +y, -y, +z (front), -z
  const mats = [steel, steel, steel, steel, face, steel];
  return (
    <group>
      {/* short post, sunk into the regolith */}
      <mesh position={[0, POST_H / 2 - 0.1, -0.05]} castShadow material={steel}>
        <cylinderGeometry args={[0.035, 0.04, POST_H + 0.2, 20]} />
      </mesh>
      <group
        position={[0, POST_H + PLAQUE_H / 2, 0]}
        rotation={[-PLAQUE_TILT, 0, 0]}
      >
        <mesh castShadow receiveShadow material={mats}>
          <boxGeometry args={[PLAQUE_W, PLAQUE_H, 0.025]} />
        </mesh>
        {/* mounting bracket */}
        <mesh position={[0, -0.1, -0.03]} castShadow material={steel}>
          <boxGeometry args={[0.12, 0.5, 0.03]} />
        </mesh>
      </group>
    </group>
  );
};

// boot print (ridged sole), dark depression with a sunlit rim on one side
let bootTex: THREE.CanvasTexture | null = null;
export const getBootTexture = () => {
  if (bootTex) return bootTex;
  const W = 128,
    Hh = 320;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = Hh;
  const g = c.getContext("2d")!;
  g.save();
  g.beginPath();
  g.ellipse(W / 2, Hh * 0.3, W * 0.42, Hh * 0.28, 0, 0, Math.PI * 2);
  g.ellipse(W / 2, Hh * 0.76, W * 0.36, Hh * 0.2, 0, 0, Math.PI * 2);
  g.rect(W * 0.16, Hh * 0.3, W * 0.68, Hh * 0.46);
  g.clip();
  g.fillStyle = "rgba(5,5,5,0.95)";
  g.fillRect(0, 0, W, Hh);
  // chevron ridges of the sole
  g.strokeStyle = "rgba(205,205,205,0.75)";
  g.lineWidth = 5;
  for (let y = 14; y < Hh; y += 18) {
    g.beginPath();
    g.moveTo(0, y + 8);
    g.lineTo(W / 2, y);
    g.lineTo(W, y + 8);
    g.stroke();
  }
  g.restore();
  bootTex = new THREE.CanvasTexture(c);
  bootTex.colorSpace = THREE.SRGBColorSpace;
  return bootTex;
};
