import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { DURATION } from "./venus/timeline";
import { VenusVideo } from "./venus/VenusVideo";

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
    </>
  );
};
