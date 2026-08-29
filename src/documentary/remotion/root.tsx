import React from "react";
import {Composition} from "remotion";

import {DocumentaryComposition} from "./DocumentaryComposition";
import type {DocumentaryProps} from "./types";

const defaultProps: DocumentaryProps = {
  projectId: "unconfigured-documentary",
  projectVersion: 0,
  title: "Unconfigured documentary",
  timeline: {fps: 30, durationFrames: 2100, durationSeconds: 70, scenes: []},
  render: {
    composition: {width: 1920, height: 1080, fps: 30, durationFrames: 2100},
  },
  sources: {},
  audioSlots: {},
  provenance: {artifactChecksums: {}, approvalRecordIds: {}},
};

export const DocumentaryRoot: React.FC = () => (
  <Composition
    id="DocumentaryPrototype"
    component={DocumentaryComposition}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={2100}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({
      width: props.render.composition.width,
      height: props.render.composition.height,
      fps: props.render.composition.fps,
      durationInFrames: props.render.composition.durationFrames,
    })}
  />
);
