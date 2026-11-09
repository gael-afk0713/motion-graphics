import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { DURATION } from "./venus/timeline";
import { DURATION as LESMA_DURATION } from "./lesma/timeline";
import { LesmaVideo } from "./lesma/LesmaVideo";
import { DURATION as OVELHA_DURATION } from "./ovelha/timeline";
import { OvelhaVideo } from "./ovelha/OvelhaVideo";
import { VenusVideo } from "./venus/VenusVideo";
import { DURATION as FOGUETE_DURATION } from "./foguete/timeline";
import { FogueteVideo } from "./foguete/FogueteVideo";
import { CuriosarioOutro, OUTRO_DURATION, OUTRO_FPS } from "./components/CuriosarioOutro";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="Venus"
        component={VenusVideo}
        durationInFrames={DURATION}
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
        component={OvelhaVideo}
        durationInFrames={OVELHA_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Foguete"
        component={FogueteVideo}
        durationInFrames={FOGUETE_DURATION}
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
