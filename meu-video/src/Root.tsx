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
import { PapagaioVideo } from "./papagaio/PapagaioVideo";

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
