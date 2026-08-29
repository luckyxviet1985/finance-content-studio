import {assertProjectBundle} from "./project-contract.mjs";

const WATERMARK = "PREVIEW — NOT APPROVED FOR RELEASE";

const scenePresentation = {
  "cold-open": {
    motif: "bank-queue",
    eyebrow: "ARCHIVAL IMAGE PLACEHOLDER",
    headline: "THE WEEK AMERICA CLOSED EVERY BANK",
  },
  panic: {
    motif: "bank-queue",
    eyebrow: "BANK RUN — VISUAL PENDING RIGHTS REVIEW",
    headline: "FEAR BECAME A FINANCIAL FORCE",
  },
  "bank-holiday": {
    motif: "newspaper",
    eyebrow: "EMERGENCY ACTION",
    headline: "A NATIONAL BANK HOLIDAY",
  },
  "trust-problem": {
    motif: "confidence-meter",
    eyebrow: "THE HIDDEN MECHANISM",
    headline: "A BANK RUNS ON TRUST",
  },
  "radio-setup": {
    motif: "radio",
    eyebrow: "ARCHIVAL PHOTO PLACEHOLDER",
    headline: "ROOSEVELT ENTERED AMERICAN HOMES",
  },
  "archival-voice": {
    motif: "radio-wave",
    eyebrow: "FDR AUDIO EXCERPT PLACEHOLDER — 12:16–12:28",
    headline: "THE CONFIDENCE OF THE PEOPLE THEMSELVES",
  },
  resolution: {
    motif: "reopening-bank",
    eyebrow: "THE SYSTEM REOPENS",
    headline: "LAW + LIQUIDITY + TRUST",
  },
  "end-card": {
    motif: "end-card",
    eyebrow: "THE LESSON",
    headline: "CONFIDENCE IS INFRASTRUCTURE",
  },
};

const sanitizeScene = (scene) => {
  const presentation = scenePresentation[scene.id];
  if (!presentation) {
    throw new Error(`Preview presentation is not defined for scene ${scene.id}`);
  }
  return {
    id: scene.id,
    startFrame: scene.startFrame,
    endFrame: scene.endFrame,
    visual: {kind: "procedural-placeholder", ...presentation},
    draftText: scene.audio.text ?? scene.audio.transcript ?? null,
    caption: scene.caption,
  };
};

export const assertPreviewProps = (props) => {
  const errors = [];
  if (props?.mode !== "unapproved-animatic-preview") {
    errors.push("preview mode marker is missing");
  }
  if (props?.watermark?.required !== true || props?.watermark?.text !== WATERMARK) {
    errors.push("the permanent preview watermark is required");
  }
  if (
    props?.audio?.status !== "unavailable" ||
    props?.audio?.provider !== null ||
    "path" in (props?.audio ?? {})
  ) {
    errors.push("preview audio must remain unavailable and provider-neutral");
  }
  if (props?.publishing?.enabled !== false || props?.publishing?.destinations?.length !== 0) {
    errors.push("preview publishing must remain disabled");
  }
  if (props?.externalMedia !== undefined) {
    errors.push("preview props must not contain external media inputs");
  }
  if (!Array.isArray(props?.timeline?.scenes) || props.timeline.scenes.length === 0) {
    errors.push("preview must contain at least one scene");
  }
  for (const scene of props?.timeline?.scenes ?? []) {
    if (scene.visual?.kind !== "procedural-placeholder") {
      errors.push(`scene ${scene.id} must use a procedural placeholder`);
    }
  }
  const serialized = JSON.stringify(props ?? {});
  if (/https?:\/\//i.test(serialized) || /public[\\/]|\.(wav|mp3|ogg|jpg|jpeg|png)\b/i.test(serialized)) {
    errors.push("preview props contain a URL or media file reference");
  }
  if (/"(sourceId|providerBinding|audioSlots|sources|path|url)"\s*:/i.test(serialized)) {
    errors.push("preview props contain a forbidden external-input field");
  }
  if (errors.length > 0) {
    throw new Error(`Documentary preview contract is invalid:\n- ${errors.join("\n- ")}`);
  }
};

export const buildPreviewProps = (bundle) => {
  assertProjectBundle(bundle);
  const props = {
    mode: "unapproved-animatic-preview",
    projectId: bundle.manifest.projectId,
    projectVersion: bundle.manifest.projectVersion,
    title: bundle.manifest.title,
    timeline: {
      fps: bundle.timeline.fps,
      durationFrames: bundle.timeline.durationFrames,
      durationSeconds: bundle.timeline.durationSeconds,
      scenes: bundle.timeline.scenes.map(sanitizeScene),
    },
    composition: {...bundle.render.composition},
    watermark: {required: true, text: WATERMARK},
    audio: {
      status: "unavailable",
      provider: null,
      reason: "OpenMontage production checkout or approved provider is not configured",
    },
    publishing: {enabled: false, destinations: []},
    provenance: {
      timelineSha256: bundle.checksums.timeline,
      renderContractSha256: bundle.checksums.render,
      approvalStatuses: Object.fromEntries(
        Object.entries(bundle.manifest.approvalGates).map(([gate, approval]) => [
          gate,
          approval.status,
        ]),
      ),
      previewPolicy: "issue-14-preview-isolation-v1",
    },
  };
  assertPreviewProps(props);
  return props;
};
