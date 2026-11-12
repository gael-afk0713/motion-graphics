import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { CONTENT_DURATION as VENUS_CONTENT } from "./venus/timeline";
import { DURATION as LESMA_DURATION } from "./lesma/timeline";
import { LesmaVideo } from "./lesma/LesmaVideo";
import { DURATION as OVELHA_DURATION } from "./ovelha/timeline";
import { OvelhaVideo } from "./ovelha/OvelhaVideo";
import { VenusVideo } from "./venus/VenusVideo";
import { CONTENT_DURATION as FOGUETE_CONTENT } from "./foguete/timeline";
import { FogueteVideo } from "./foguete/FogueteVideo";
import { CuriosarioOutro, OUTRO_DURATION, OUTRO_FPS } from "./components/CuriosarioOutro";
import { WithOutro, withOutroDuration } from "./components/WithOutro";
import { DURATION as PAPAGAIO1_DURATION } from "./papagaio/timeline";
import { PapagaioSfxStem, PapagaioVideo } from "./papagaio/PapagaioVideo";
import { FishSheet } from "./papagaio/Scene3D";
import { SfxDemo, SfxDemoStem } from "./sfxdemo/SfxDemo";
import { DURATION as PAPAGAIO2_DURATION } from "./papagaio2/timeline";
import { Papagaio2SfxStem, Papagaio2Video } from "./papagaio2/Papagaio2Video";

// Peixe-papagaio, parte 2/3 (the audience chose A, the slime sleeping bag): scenes 1-9, then the ending
const Papagaio2ComOutro: React.FC = () => (
  <WithOutro contentFrames={PAPAGAIO2_DURATION}>
    <Papagaio2Video />
  </WithOutro>
);
import { DURATION as SFXDEMO_DURATION } from "./sfxdemo/sfx";

// every video ends with the standard Curiosário ending (see CLAUDE.md)
// Venus: scenes 1-5, then the ending (replaces the "Segue pra mais" CTA scene)
const VenusComOutro: React.FC = () => (
  <WithOutro contentFrames={VENUS_CONTENT}>
    <VenusVideo />
  </WithOutro>
);
const OvelhaComOutro: React.FC = () => (
  <WithOutro contentFrames={OVELHA_DURATION}>
    <OvelhaVideo />
  </WithOutro>
);
// Foguete: scenes 1-6, then the ending (replaces scene 7, the plaque)
const FogueteComOutro: React.FC = () => (
  <WithOutro contentFrames={FOGUETE_CONTENT}>
    <FogueteVideo />
  </WithOutro>
);

// Peixe-papagaio, parte 1/3: scenes 1-9, then the standard ending
const Papagaio1ComOutro: React.FC = () => (
  <WithOutro contentFrames={PAPAGAIO1_DURATION}>
    <PapagaioVideo />
  </WithOutro>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="Venus"
        component={VenusComOutro}
        durationInFrames={withOutroDuration(VENUS_CONTENT)}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Lesma"
        component={LesmaVideo}
        durationInFrames={LESMA_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Ovelha"
        component={OvelhaComOutro}
        durationInFrames={withOutroDuration(OVELHA_DURATION)}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Foguete"
        component={FogueteComOutro}
        durationInFrames={withOutroDuration(FOGUETE_CONTENT)}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Papagaio1"
        component={Papagaio1ComOutro}
        durationInFrames={withOutroDuration(PAPAGAIO1_DURATION)}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* effects only, for the SFX sync check (scripts/sfx_sync_check.py) */}
      <Composition id="Papagaio1Sfx" component={PapagaioSfxStem} durationInFrames={PAPAGAIO1_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Papagaio2" component={Papagaio2ComOutro} durationInFrames={withOutroDuration(PAPAGAIO2_DURATION)} fps={30} width={1080} height={1920} />
      <Composition id="Papagaio2Sfx" component={Papagaio2SfxStem} durationInFrames={PAPAGAIO2_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Papagaio1Peixe" component={FishSheet} durationInFrames={3} fps={30} width={1080} height={1920} />
      {/* test of the earshot SFX workflow (kit + sync check), not a channel video */}
      <Composition id="SfxSyncDemo" component={SfxDemo} durationInFrames={SFXDEMO_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="SfxSyncDemoSfx" component={SfxDemoStem} durationInFrames={SFXDEMO_DURATION} fps={30} width={1080} height={1920} />
      <Composition
        id="Outro"
        component={CuriosarioOutro}
        durationInFrames={OUTRO_DURATION}
        fps={OUTRO_FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
