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
