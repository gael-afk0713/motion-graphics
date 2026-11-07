import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";

type Props = { outShare: number };

// The outgoing scene fades out in the first `outShare` of the transition;
// the incoming scene is fully opaque (its words animate in on their own,
// timed to the narration), so new text is never half-transparent.
const QuickOutPresentation: React.FC<
  TransitionPresentationComponentProps<Props>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  if (presentationDirection === "entering") {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(presentationProgress, [0, passedProps.outShare], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(presentationProgress, [0, passedProps.outShare], [1, 0.96], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const quickOut = (outShare = 0.375): TransitionPresentation<Props> => ({
  component: QuickOutPresentation,
  props: { outShare },
});
