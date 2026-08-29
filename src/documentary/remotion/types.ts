export type Scene = {
  id: string;
  startFrame: number;
  endFrame: number;
  visual:
    | {
        kind: "archival-image";
        sourceId: string;
        motion: string;
      }
    | {
        kind: "typographic-card";
        headline: string;
        motion: string;
      };
  audio: {
    slotId: string;
    text?: string | null;
    sourceInMs?: number;
    sourceOutMs?: number;
    transcript?: string;
  };
  caption: string | null;
  evidenceSourceIds: string[];
};

export type AudioSlot = {
  id: string;
  kind: string;
  requiredForRender: boolean;
  clip?: {inMs: number; outMs: number};
  output: {
    status: string;
    path: string | null;
    mediaType: string | null;
    sha256: string | null;
  };
};

export type DocumentaryProps = {
  projectId: string;
  projectVersion: number;
  title: string;
  timeline: {
    fps: number;
    durationFrames: number;
    durationSeconds: number;
    scenes: Scene[];
  };
  render: {
    composition: {
      width: number;
      height: number;
      fps: number;
      durationFrames: number;
    };
  };
  sources: Record<string, string>;
  audioSlots: Record<string, AudioSlot>;
  provenance: {
    artifactChecksums: Record<string, string>;
    approvalRecordIds: Record<string, string | null>;
  };
};

export type PreviewScene = {
  id: string;
  startFrame: number;
  endFrame: number;
  visual: {
    kind: "procedural-placeholder";
    motif:
      | "bank-queue"
      | "newspaper"
      | "confidence-meter"
      | "radio"
      | "radio-wave"
      | "reopening-bank"
      | "end-card";
    eyebrow: string;
    headline: string;
  };
  draftText: string | null;
  caption: string | null;
};

export type DocumentaryPreviewProps = {
  mode: "unapproved-animatic-preview";
  projectId: string;
  projectVersion: number;
  title: string;
  timeline: {
    fps: number;
    durationFrames: number;
    durationSeconds: number;
    scenes: PreviewScene[];
  };
  composition: {
    width: number;
    height: number;
    fps: number;
    durationFrames: number;
  };
  watermark: {required: true; text: string};
  audio: {status: "unavailable"; provider: null; reason: string};
  publishing: {enabled: false; destinations: []};
  provenance: {
    timelineSha256: string;
    renderContractSha256: string;
    approvalStatuses: Record<string, string>;
    previewPolicy: string;
  };
};
