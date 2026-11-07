import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { VenusVideo } from "./venus/VenusVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="Venus"
        component={VenusVideo}
        durationInFrames={480}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
