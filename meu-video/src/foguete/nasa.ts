import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";

// Real NASA imagery (public domain), stored in public/foguete/tex:
// - moon_color.jpg  = CGI Moon Kit lroc_color_poles_4k (NASA SVS 4720)
// - moon_normal.jpg = normal map computed from the Moon Kit ldem_16_uint elevation (x6 relief)
// - earth_bluemarble_clouds.jpg = Blue Marble Earth with clouds (NASA SVS 3615, flat_earth03)
type Tex = {
  moonMap: THREE.Texture;
  moonNormal: THREE.Texture;
  earth: THREE.Texture;
};

let cache: Tex | null = null;
let pending: Promise<Tex> | null = null;

const load = (url: string, srgb: boolean) =>
  new Promise<THREE.Texture>((res, rej) =>
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        res(t);
      },
      undefined,
      rej,
    ),
  );

const loadAll = () => {
  pending ??= Promise.all([
    load(staticFile("foguete/tex/moon_color.jpg"), true),
    load(staticFile("foguete/tex/moon_normal.jpg"), false),
    load(staticFile("foguete/tex/earth_bluemarble_clouds.jpg"), true),
    // the plaque texture is drawn with Montserrat: make sure the font is ready first
    document.fonts
      .load("800 100px Montserrat")
      .then(() => document.fonts.load("700 100px Montserrat")),
  ]).then(
    ([moonMap, moonNormal, earth]) =>
      (cache = {
        moonMap,
        moonNormal,
        earth,
      }),
  );
  return pending;
};

export const useNasaTextures = () => {
  const [tex, setTex] = useState<Tex | null>(cache);
  const [handle] = useState(() =>
    cache ? null : delayRender("NASA textures"),
  );
  useEffect(() => {
    if (cache) return;
    loadAll()
      .then((t) => setTex(t))
      .catch((e) => {
        throw e;
      });
  }, []);
  // release only after the commit that mounted the 3D canvas (it then keeps its own delayRender)
  useEffect(() => {
    if (tex && handle !== null) continueRender(handle);
  }, [tex, handle]);
  return tex;
};
