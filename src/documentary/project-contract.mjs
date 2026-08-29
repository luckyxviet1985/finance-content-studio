import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";

import {
  validateAllowlistedUrl,
  validateMediaTargetPath,
} from "./media-ingestion.mjs";

const REQUIRED_APPROVAL_GATES = [
  "topic",
  "script",
  "finalVideo",
  "publicPublishing",
];
const ARTIFACT_KEYS = [
  "timeline",
  "sourceLedger",
  "audioSlots",
  "mediaIngestion",
  "render",
];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const readJsonArtifact = async (manifestDirectory, reference) => {
  const artifactPath = path.resolve(manifestDirectory, reference.path);
  const relative = path.relative(manifestDirectory, artifactPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Artifact path escapes project version directory: ${reference.path}`);
  }

  const bytes = await readFile(artifactPath);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== reference.sha256) {
    throw new Error(
      `Artifact checksum mismatch for ${reference.path}: expected ${reference.sha256}, received ${actualSha256}`,
    );
  }

  return {
    value: JSON.parse(bytes.toString("utf8")),
    path: artifactPath,
    sha256: actualSha256,
  };
};

export const loadProjectBundle = async (manifestPath) => {
  const absoluteManifestPath = path.resolve(manifestPath);
  const manifest = JSON.parse(await readFile(absoluteManifestPath, "utf8"));
  const manifestDirectory = path.dirname(absoluteManifestPath);

  for (const key of ARTIFACT_KEYS) {
    if (!manifest.artifacts?.[key]) {
      throw new Error(`Project manifest is missing artifact reference: ${key}`);
    }
  }

  const loaded = Object.fromEntries(
    await Promise.all(
      ARTIFACT_KEYS.map(async (key) => [
        key,
        await readJsonArtifact(manifestDirectory, manifest.artifacts[key]),
      ]),
    ),
  );

  return {
    manifest,
    timeline: loaded.timeline.value,
    sources: loaded.sourceLedger.value,
    audioSlots: loaded.audioSlots.value,
    ingestion: loaded.mediaIngestion.value,
    render: loaded.render.value,
    paths: {
      manifest: absoluteManifestPath,
      projectDirectory: manifestDirectory,
      timeline: loaded.timeline.path,
      sources: loaded.sourceLedger.path,
      audioSlots: loaded.audioSlots.path,
      ingestion: loaded.mediaIngestion.path,
      render: loaded.render.path,
    },
    checksums: Object.fromEntries(
      ARTIFACT_KEYS.map((key) => [key, loaded[key].sha256]),
    ),
  };
};

const validateIdentity = (bundle, errors) => {
  const {projectId, projectVersion} = bundle.manifest;
  for (const [name, artifact] of [
    ["timeline", bundle.timeline],
    ["source ledger", bundle.sources],
    ["audio slots", bundle.audioSlots],
    ["ingestion contract", bundle.ingestion],
    ["render contract", bundle.render],
  ]) {
    if (artifact.schemaVersion !== 1) {
      errors.push(`${name} must use schemaVersion 1`);
    }
    if (
      artifact.projectId !== projectId ||
      artifact.projectVersion !== projectVersion
    ) {
      errors.push(`${name} identity does not match the project manifest`);
    }
  }
};

const validateApprovals = (manifest, errors) => {
  for (const gate of REQUIRED_APPROVAL_GATES) {
    const record = manifest.approvalGates?.[gate];
    if (!record) {
      errors.push(`Mandatory approval gate is missing: ${gate}`);
      continue;
    }
    if (!['pending', 'approved', 'rejected', 'invalidated'].includes(record.status)) {
      errors.push(`Approval gate ${gate} has an invalid status`);
    }
    if (record.status === "approved") {
      if (!record.approvalRecordId || !record.pinnedArtifactVersion) {
        errors.push(
          `Approved gate ${gate} must pin an immutable artifact version and approval record`,
        );
      }
    }
    if (!Array.isArray(record.invalidateOnChange) || record.invalidateOnChange.length === 0) {
      errors.push(`Approval gate ${gate} must declare invalidation dependencies`);
    }
  }

  if (manifest.capabilities?.publicPublishing !== false) {
    errors.push("The documentary prototype must not enable public publishing");
  }
  if (manifest.capabilities?.autonomousRightsDecision !== false) {
    errors.push("The documentary prototype must not enable autonomous rights decisions");
  }
  if (manifest.capabilities?.productionElevenLabs !== false) {
    errors.push("The documentary prototype must not enable ElevenLabs production integration");
  }
  if (manifest.capabilities?.multiChannel !== false) {
    errors.push("The documentary prototype must remain single-channel");
  }
};

const validateTimeline = (timeline, sourceIds, slotIds, errors) => {
  if (!Number.isInteger(timeline.fps) || timeline.fps <= 0) {
    errors.push("Timeline fps must be a positive integer");
    return;
  }
  if (timeline.durationFrames / timeline.fps < 60 || timeline.durationFrames / timeline.fps > 75) {
    errors.push("Timeline duration must be between 60 and 75 seconds");
  }
  if (timeline.durationSeconds !== timeline.durationFrames / timeline.fps) {
    errors.push("Timeline durationSeconds must exactly match frames / fps");
  }

  let expectedStart = 0;
  for (const scene of timeline.scenes ?? []) {
    if (scene.startFrame !== expectedStart) {
      errors.push(`Scene ${scene.id} does not start at frame ${expectedStart}`);
    }
    if (!Number.isInteger(scene.endFrame) || scene.endFrame <= scene.startFrame) {
      errors.push(`Scene ${scene.id} has an invalid frame range`);
    }
    expectedStart = scene.endFrame;

    if (scene.audio?.slotId && !slotIds.has(scene.audio.slotId)) {
      errors.push(`Scene ${scene.id} references unknown audio slot ${scene.audio.slotId}`);
    }
    if (scene.visual?.sourceId && !sourceIds.has(scene.visual.sourceId)) {
      errors.push(`Scene ${scene.id} references unknown visual source ${scene.visual.sourceId}`);
    }
    for (const sourceId of scene.evidenceSourceIds ?? []) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`Scene ${scene.id} references unknown evidence source ${sourceId}`);
      }
    }
  }
  if (expectedStart !== timeline.durationFrames) {
    errors.push("Scenes must be contiguous and end at durationFrames");
  }
};

const validateSourcesAndIngestion = (bundle, errors) => {
  const sources = new Map(bundle.sources.sources.map((source) => [source.id, source]));
  for (const source of sources.values()) {
    if (!source.catalogUrl || !source.rights?.claim || !source.intendedUse) {
      errors.push(`Source ${source.id} lacks catalog, rights, or intended-use metadata`);
    }
  }

  for (const asset of bundle.ingestion.assets ?? []) {
    const source = sources.get(asset.sourceId);
    if (!source) {
      errors.push(`Ingestion asset references unknown source ${asset.sourceId}`);
      continue;
    }
    try {
      validateAllowlistedUrl(source.catalogUrl, bundle.ingestion.allowedCatalogs);
      validateAllowlistedUrl(source.downloadUrl, bundle.ingestion.allowedDownloads);
      validateMediaTargetPath(asset.targetPath);
    } catch (error) {
      errors.push(`Source ${source.id}: ${error.message}`);
    }
    if (
      asset.expectedSha256 !== source.expectedSha256 ||
      asset.expectedBytes !== source.expectedBytes ||
      asset.expectedMediaType !== source.mediaType
    ) {
      errors.push(`Ingestion asset ${source.id} does not pin source ledger metadata`);
    }
    if (!SHA256_PATTERN.test(asset.expectedSha256)) {
      errors.push(`Ingestion asset ${source.id} has an invalid SHA-256 checksum`);
    }
    if (asset.rightsReviewRequired !== true) {
      errors.push(`Ingestion asset ${source.id} must require human rights review`);
    }
  }
  return sources;
};

const validateAudio = (bundle, sources, errors) => {
  for (const slot of bundle.audioSlots.slots ?? []) {
    if (slot.providerBinding !== null) {
      errors.push(`Audio slot ${slot.id} must remain provider-neutral in v1`);
    }
    if (slot.kind === "archival-audio-clip") {
      const source = sources.get(slot.sourceId);
      if (!source) {
        errors.push(`Audio slot ${slot.id} references unknown source ${slot.sourceId}`);
      } else if (
        slot.clip.inMs !== source.clip?.inMs ||
        slot.clip.outMs !== source.clip?.outMs
      ) {
        errors.push(`Audio slot ${slot.id} clip does not match the source ledger`);
      }
    }
  }
};

const validateRender = (bundle, errors) => {
  const {composition} = bundle.render;
  if (
    composition.fps !== bundle.timeline.fps ||
    composition.durationFrames !== bundle.timeline.durationFrames
  ) {
    errors.push("Render composition timing must match the timeline");
  }
  if (
    bundle.render.publishing?.enabled !== false ||
    bundle.render.publishing?.destinations?.length !== 0
  ) {
    errors.push("Render contract must not contain publishing behavior");
  }
  if (
    !bundle.render.requiredApprovalGates?.includes("topic") ||
    !bundle.render.requiredApprovalGates?.includes("script")
  ) {
    errors.push("Render contract must require Topic and Script approval");
  }
};

export const validateProjectBundle = (bundle) => {
  const errors = [];
  if (bundle.manifest.schemaVersion !== 1 || bundle.manifest.projectVersion !== 1) {
    errors.push("Project manifest must use schemaVersion 1 and projectVersion 1");
  }
  for (const key of ARTIFACT_KEYS) {
    if (!SHA256_PATTERN.test(bundle.manifest.artifacts?.[key]?.sha256 ?? "")) {
      errors.push(`Artifact ${key} must be pinned with a SHA-256 checksum`);
    }
  }
  validateIdentity(bundle, errors);
  validateApprovals(bundle.manifest, errors);
  const sourceIds = new Set(bundle.sources.sources.map((source) => source.id));
  if (sourceIds.size !== bundle.sources.sources.length) {
    errors.push("Source ledger identifiers must be unique");
  }
  const slotIds = new Set(bundle.audioSlots.slots.map((slot) => slot.id));
  if (slotIds.size !== bundle.audioSlots.slots.length) {
    errors.push("Audio slot identifiers must be unique");
  }
  validateTimeline(bundle.timeline, sourceIds, slotIds, errors);
  const sources = validateSourcesAndIngestion(bundle, errors);
  validateAudio(bundle, sources, errors);
  validateRender(bundle, errors);
  return errors;
};

export const assertProjectBundle = (bundle) => {
  const errors = validateProjectBundle(bundle);
  if (errors.length > 0) {
    throw new Error(`Documentary project contract is invalid:\n- ${errors.join("\n- ")}`);
  }
};

export const assertIngestionReady = (bundle) => {
  assertProjectBundle(bundle);
  const topic = bundle.manifest.approvalGates.topic;
  if (topic.status !== "approved" || !topic.approvalRecordId || !topic.pinnedArtifactVersion) {
    throw new Error("Media ingestion is blocked until a human Topic approval pins an immutable artifact version");
  }
};

export const assertRenderReady = (bundle) => {
  assertProjectBundle(bundle);
  for (const gate of bundle.render.requiredApprovalGates) {
    const approval = bundle.manifest.approvalGates[gate];
    if (
      approval?.status !== "approved" ||
      !approval.approvalRecordId ||
      !approval.pinnedArtifactVersion
    ) {
      throw new Error(`Render is blocked until the ${gate} gate has a pinned human approval`);
    }
  }
  for (const [slotId, requiredStatus] of Object.entries(
    bundle.render.requiredArtifactStates,
  )) {
    const slot = bundle.audioSlots.slots.find((candidate) => candidate.id === slotId);
    if (!slot || slot.output.status !== requiredStatus || !slot.output.sha256) {
      throw new Error(`Render is blocked until audio slot ${slotId} is ${requiredStatus}`);
    }
  }
};
