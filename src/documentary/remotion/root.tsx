import React from "react";
import {Composition} from "remotion";

import {DocumentaryComposition} from "./DocumentaryComposition";
import {DocumentaryPreviewComposition} from "./DocumentaryPreviewComposition";
import type {DocumentaryPreviewProps, DocumentaryProps} from "./types";

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

const defaultPreviewProps: DocumentaryPreviewProps = {
  mode: "unapproved-animatic-preview",
  projectId: "unconfigured-documentary-preview",
  projectVersion: 0,
  title: "Unconfigured documentary preview",
  timeline: {fps: 30, durationFrames: 2100, durationSeconds: 70, scenes: []},
  composition: {width: 1920, height: 1080, fps: 30, durationFrames: 2100},
  watermark: {required: true, text: "PREVIEW — NOT APPROVED FOR RELEASE"},
  audio: {status: "unavailable", provider: null, reason: "No provider configured"},
  publishing: {enabled: false, destinations: []},
  provenance: {
    timelineSha256: "",
    renderContractSha256: "",
    approvalStatuses: {},
    previewPolicy: "issue-14-preview-isolation-v1",
  },
};

export const DocumentaryRoot: React.FC = () => (
  <>
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
    <Composition
      id="DocumentaryAnimaticPreview"
      component={DocumentaryPreviewComposition}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={2100}
      defaultProps={defaultPreviewProps}
      calculateMetadata={({props}) => ({
        width: props.composition.width,
        height: props.composition.height,
        fps: props.composition.fps,
        durationInFrames: props.composition.durationFrames,
      })}
    />
  </>
);
