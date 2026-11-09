// Standard Curiosário ending: every video (from "Bendegó" on) ends with
// <CuriosarioOutro />. Wrap the video's content with <WithOutro> and register
// the composition with withOutroDuration(contentFrames).
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { CuriosarioOutro, OUTRO_DURATION } from "./CuriosarioOutro";

export { OUTRO_DURATION };

/** Total composition length: the video's own frames + the standard ending. */
export const withOutroDuration = (contentFrames: number) => contentFrames + OUTRO_DURATION;

/** Plays `children` for `contentFrames`, then the standard Curiosário ending. */
export const WithOutro: React.FC<{ contentFrames: number; children: React.ReactNode }> = ({
  contentFrames,
  children,
}) => (
  <AbsoluteFill>
    <Sequence durationInFrames={contentFrames} name="Conteúdo">
      {children}
    </Sequence>
    <Sequence from={contentFrames} durationInFrames={OUTRO_DURATION} name="Ending Curiosário">
      <CuriosarioOutro />
    </Sequence>
  </AbsoluteFill>
);
