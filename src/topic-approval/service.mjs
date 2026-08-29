import {randomUUID} from "node:crypto";

import {sha256Json} from "./canonical.mjs";
import {fail} from "./errors.mjs";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const APPROVER_ROLES = new Set(["editor", "admin"]);
const ACTOR_TYPES = new Set(["human", "agent", "system"]);
const DECISIONS = new Set(["approved", "rejected"]);
const MAX_JSON_BYTES = 65_536;

const requireString = (value, field, {max = 4000} = {}) => {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    fail("INVALID_INPUT", `${field} must be a non-empty string of at most ${max} characters`);
  }
  return value.trim();
};

const requireSha256 = (value, field) => {
  if (!SHA256_PATTERN.test(value ?? "")) {
    fail("INVALID_INPUT", `${field} must be a lowercase SHA-256 checksum`);
  }
  return value;
};

const normalizeJsonRecord = (value, field, {nullable = false} = {}) => {
  if (value === null && nullable) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_INPUT", `${field} must be a JSON object`);
  }

  const ancestors = new WeakSet();
  const validate = (entry, depth) => {
    if (depth > 20) fail("INVALID_INPUT", `${field} exceeds the maximum nesting depth`);
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "boolean" ||
      (typeof entry === "number" && Number.isFinite(entry))
    ) {
      return;
    }
    if (!entry || typeof entry !== "object") {
      fail("INVALID_INPUT", `${field} contains a non-JSON value`);
    }
    const prototype = Object.getPrototypeOf(entry);
    if (!Array.isArray(entry) && prototype !== Object.prototype && prototype !== null) {
      fail("INVALID_INPUT", `${field} contains a non-plain object`);
    }
    if (ancestors.has(entry)) fail("INVALID_INPUT", `${field} contains a cycle`);
    ancestors.add(entry);
    for (const child of Array.isArray(entry) ? entry : Object.values(entry)) {
      validate(child, depth + 1);
    }
    ancestors.delete(entry);
  };

  validate(value, 0);
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_JSON_BYTES) {
    fail("INVALID_INPUT", `${field} exceeds ${MAX_JSON_BYTES} bytes`);
  }
  return JSON.parse(serialized);
};

const requireAuthenticatedActor = (actor) => {
  if (
    !actor ||
    actor.authenticated !== true ||
    !ACTOR_TYPES.has(actor.type) ||
    typeof actor.id !== "string" ||
    actor.id.length === 0 ||
    typeof actor.authSource !== "string" ||
    actor.authSource.length === 0
  ) {
    fail("UNAUTHENTICATED_ACTOR", "A trusted authenticated actor context is required");
  }
};

const requireHumanApprover = (actor) => {
  if (
    !actor ||
    actor.authenticated !== true ||
    actor.type !== "human" ||
    !APPROVER_ROLES.has(actor.role) ||
    typeof actor.id !== "string" ||
    actor.id.length === 0 ||
    typeof actor.authSource !== "string" ||
    actor.authSource.length === 0
  ) {
    fail(
      "UNAUTHORIZED_APPROVER",
      "Topic review and decisions require an authenticated human editor or admin",
    );
  }
};

const normalizeUrl = (value, field) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("INVALID_INPUT", `${field} must be a valid HTTPS URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    fail("INVALID_INPUT", `${field} must be a credential-free HTTPS URL`);
  }
  return url.toString();
};

const normalizeProvenance = (provenance) => {
  if (!provenance || typeof provenance !== "object") {
    fail("INVALID_INPUT", "proposal.provenance is required");
  }
  return {
    policyVersion: requireString(provenance.policyVersion, "provenance.policyVersion", {
      max: 200,
    }),
    prompt: normalizeJsonRecord(provenance.prompt ?? null, "provenance.prompt", {
      nullable: true,
    }),
    model: normalizeJsonRecord(provenance.model ?? null, "provenance.model", {
      nullable: true,
    }),
    tool: normalizeJsonRecord(provenance.tool ?? null, "provenance.tool", {
      nullable: true,
    }),
  };
};

const normalizeEvidence = (evidence) => {
  if (!Array.isArray(evidence) || evidence.length === 0 || evidence.length > 100) {
    fail("INVALID_INPUT", "At least one and at most 100 evidence records are required");
  }
  const sourceIds = new Set();
  return evidence.map((item, index) => {
    const sourceId = requireString(item?.sourceId, `evidence[${index}].sourceId`, {max: 200});
    if (sourceIds.has(sourceId)) {
      fail("INVALID_INPUT", `Duplicate evidence sourceId: ${sourceId}`);
    }
    sourceIds.add(sourceId);
    const capturedAt = requireString(item.capturedAt, `evidence[${index}].capturedAt`, {
      max: 100,
    });
    if (Number.isNaN(Date.parse(capturedAt))) {
      fail("INVALID_INPUT", `evidence[${index}].capturedAt must be an ISO timestamp`);
    }
    return {
      sourceId,
      sourceUrl: normalizeUrl(item.sourceUrl, `evidence[${index}].sourceUrl`),
      snapshotArtifactId: requireString(
        item.snapshotArtifactId,
        `evidence[${index}].snapshotArtifactId`,
        {max: 200},
      ),
      snapshotSha256: requireSha256(
        item.snapshotSha256,
        `evidence[${index}].snapshotSha256`,
      ),
      capturedAt: new Date(capturedAt).toISOString(),
      provenance: normalizeJsonRecord(
        item.provenance ?? {},
        `evidence[${index}].provenance`,
      ),
    };
  });
};

const normalizeScore = (score) => {
  if (!score || typeof score !== "object") {
    fail("INVALID_INPUT", "proposal.score is required");
  }
  if (
    !Number.isInteger(score.scoreVersion) ||
    score.scoreVersion < 1 ||
    typeof score.overallScore !== "number" ||
    score.overallScore < 0 ||
    score.overallScore > 100
  ) {
    fail("INVALID_INPUT", "Score version and overall score are invalid");
  }
  const dimensions = score.dimensions;
  if (!dimensions || typeof dimensions !== "object" || Array.isArray(dimensions)) {
    fail("INVALID_INPUT", "Score dimensions are required");
  }
  for (const [name, value] of Object.entries(dimensions)) {
    if (!name || typeof value !== "number" || value < 0 || value > 100) {
      fail("INVALID_INPUT", `Score dimension ${name || "<empty>"} must be between 0 and 100`);
    }
  }
  if (
    !score.producer ||
    !ACTOR_TYPES.has(score.producer.type) ||
    typeof score.producer.id !== "string" ||
    score.producer.id.length === 0
  ) {
    fail("INVALID_INPUT", "Score producer provenance is required");
  }
  return {
    scoreVersion: score.scoreVersion,
    overallScore: score.overallScore,
    dimensions: normalizeJsonRecord(dimensions, "score.dimensions"),
    rationale: requireString(score.rationale, "score.rationale"),
    producer: {
      type: score.producer.type,
      id: requireString(score.producer.id, "score.producer.id", {max: 200}),
    },
    promptProvenance: normalizeJsonRecord(
      score.promptProvenance ?? null,
      "score.promptProvenance",
      {nullable: true},
    ),
    modelProvenance: normalizeJsonRecord(
      score.modelProvenance ?? null,
      "score.modelProvenance",
      {nullable: true},
    ),
    toolProvenance: normalizeJsonRecord(
      score.toolProvenance ?? null,
      "score.toolProvenance",
      {nullable: true},
    ),
  };
};

const normalizeProposal = (proposal) => {
  if (!proposal || typeof proposal !== "object") {
    fail("INVALID_INPUT", "proposal is required");
  }
  return {
    content: {
      title: requireString(proposal.title, "proposal.title", {max: 300}),
      thesis: requireString(proposal.thesis, "proposal.thesis"),
      audience: requireString(proposal.audience, "proposal.audience", {max: 300}),
      format: requireString(proposal.format, "proposal.format", {max: 100}),
    },
    evidence: normalizeEvidence(proposal.evidence),
    score: normalizeScore(proposal.score),
    provenance: normalizeProvenance(proposal.provenance),
  };
};

const updatedWorkflow = (workflow, changes, at) => ({
  ...workflow,
  ...changes,
  lockVersion: workflow.lockVersion + 1,
  updatedAt: at,
});

export class TopicApprovalService {
  constructor({repository, now = () => new Date().toISOString(), idFactory = randomUUID}) {
    if (!repository?.transaction) {
      throw new Error("TopicApprovalService requires a transactional repository");
    }
    this.repository = repository;
    this.now = now;
    this.idFactory = idFactory;
  }

  buildVersionRecords({candidateId, versionNumber, proposal, actor, at}) {
    const normalized = normalizeProposal(proposal);
    const scoreArtifactSha256 = sha256Json(normalized.score);
    const artifactSha256 = sha256Json({
      schemaVersion: 1,
      content: normalized.content,
      provenance: normalized.provenance,
    });
    const dependencySha256 = sha256Json({
      topicArtifactSha256: artifactSha256,
      evidence: normalized.evidence.map((item) => ({
        sourceId: item.sourceId,
        snapshotArtifactId: item.snapshotArtifactId,
        snapshotSha256: item.snapshotSha256,
      })),
      scoreArtifactSha256,
      policyVersion: normalized.provenance.policyVersion,
    });
    const versionId = this.idFactory();
    return {
      version: {
        id: versionId,
        topicCandidateId: candidateId,
        versionNumber,
        content: normalized.content,
        artifactSha256,
        dependencySha256,
        provenance: normalized.provenance,
        createdByType: actor.type,
        createdById: actor.id,
        createdAt: at,
      },
      evidence: normalized.evidence.map((item) => ({
        id: this.idFactory(),
        topicVersionId: versionId,
        ...item,
      })),
      score: {
        id: this.idFactory(),
        topicVersionId: versionId,
        ...normalized.score,
        artifactSha256: scoreArtifactSha256,
        policyVersion: normalized.provenance.policyVersion,
        createdAt: at,
      },
    };
  }

  auditEvent({workflowId, topicVersionId, eventType, actor, at, payload = {}}) {
    return {
      id: this.idFactory(),
      workflowId,
      topicVersionId,
      eventType,
      actorType: actor.type,
      actorId: actor.id,
      actorRole: actor.role ?? null,
      authSource: actor.authSource,
      payload,
      occurredAt: at,
    };
  }

  async createDraft({proposal, actor}) {
    requireAuthenticatedActor(actor);
    const at = this.now();
    const workflowId = this.idFactory();
    const candidateId = this.idFactory();
    const records = this.buildVersionRecords({
      candidateId,
      versionNumber: 1,
      proposal,
      actor,
      at,
    });
    const workflow = {
      id: workflowId,
      state: "draft",
      topicCandidateId: candidateId,
      currentTopicVersionId: records.version.id,
      lockVersion: 0,
      createdAt: at,
      updatedAt: at,
    };
    const candidate = {
      id: candidateId,
      workflowId,
      createdByType: actor.type,
      createdById: actor.id,
      createdAt: at,
    };
    const audit = this.auditEvent({
      workflowId,
      topicVersionId: records.version.id,
      eventType: "topic_draft_created",
      actor,
      at,
      payload: {
        artifactSha256: records.version.artifactSha256,
        dependencySha256: records.version.dependencySha256,
      },
    });
    await this.repository.transaction((tx) =>
      tx.createInitialDraft({workflow, candidate, ...records, audit}),
    );
    return {
      workflowId,
      topicCandidateId: candidateId,
      topicVersionId: records.version.id,
      versionNumber: 1,
      artifactSha256: records.version.artifactSha256,
      dependencySha256: records.version.dependencySha256,
      state: workflow.state,
    };
  }

  async submitForApproval({workflowId, topicVersionId, actor}) {
    requireHumanApprover(actor);
    requireString(workflowId, "workflowId", {max: 100});
    requireString(topicVersionId, "topicVersionId", {max: 100});
    const at = this.now();
    return this.repository.transaction(async (tx) => {
      const workflow = await tx.getWorkflowForUpdate(workflowId);
      if (!workflow) fail("NOT_FOUND", `Workflow not found: ${workflowId}`);
      if (workflow.currentTopicVersionId !== topicVersionId) {
        fail("STALE_TOPIC_VERSION", "Only the current immutable topic version may be submitted");
      }
      if (workflow.state !== "draft") {
        fail("INVALID_TRANSITION", `Cannot submit topic from state ${workflow.state}`);
      }
      const next = updatedWorkflow(
        workflow,
        {state: "pending_topic_approval"},
        at,
      );
      const audit = this.auditEvent({
        workflowId,
        topicVersionId,
        eventType: "topic_submitted_for_approval",
        actor,
        at,
      });
      await tx.submitForApproval({workflow: next, audit});
      return {workflowId, topicVersionId, state: next.state};
    });
  }

  async decide({
    workflowId,
    topicVersionId,
    decision,
    rationale,
    idempotencyKey,
    policyVersion,
    actor,
  }) {
    requireHumanApprover(actor);
    requireString(workflowId, "workflowId", {max: 100});
    requireString(topicVersionId, "topicVersionId", {max: 100});
    if (!DECISIONS.has(decision)) {
      fail("INVALID_INPUT", "decision must be approved or rejected");
    }
    const normalizedRationale = requireString(rationale, "rationale");
    const normalizedKey = requireString(idempotencyKey, "idempotencyKey", {max: 200});
    const normalizedPolicy = requireString(policyVersion, "policyVersion", {max: 200});
    const requestSha256 = sha256Json({
      workflowId,
      topicVersionId,
      decision,
      rationale: normalizedRationale,
      idempotencyKey: normalizedKey,
      policyVersion: normalizedPolicy,
      actor: {
        type: actor.type,
        id: actor.id,
        role: actor.role,
        authSource: actor.authSource,
      },
    });
    const at = this.now();

    return this.repository.transaction(async (tx) => {
      const existing = await tx.getDecisionByIdempotency(workflowId, normalizedKey);
      if (existing) {
        if (existing.requestSha256 !== requestSha256) {
          fail(
            "IDEMPOTENCY_CONFLICT",
            "The idempotency key was already used for a different approval request",
          );
        }
        return {
          approvalId: existing.id,
          workflowId: existing.workflowId,
          topicVersionId: existing.topicVersionId,
          decision: existing.decision,
          replayed: true,
        };
      }

      const workflow = await tx.getWorkflowForUpdate(workflowId);
      if (!workflow) fail("NOT_FOUND", `Workflow not found: ${workflowId}`);
      if (workflow.currentTopicVersionId !== topicVersionId) {
        fail("STALE_TOPIC_VERSION", "The requested topic version is no longer current");
      }
      if (workflow.state !== "pending_topic_approval") {
        fail("INVALID_TRANSITION", `Cannot decide topic from state ${workflow.state}`);
      }
      const version = await tx.getTopicVersion(topicVersionId);
      if (!version) fail("NOT_FOUND", `Topic version not found: ${topicVersionId}`);

      const approval = {
        id: this.idFactory(),
        workflowId,
        gate: "topic",
        topicVersionId,
        decision,
        rationale: normalizedRationale,
        actorType: "human",
        actorId: actor.id,
        actorRole: actor.role,
        authSource: actor.authSource,
        policyVersion: normalizedPolicy,
        idempotencyKey: normalizedKey,
        requestSha256,
        topicDependencySha256: version.dependencySha256,
        createdAt: at,
      };
      const next = updatedWorkflow(
        workflow,
        {state: decision === "approved" ? "topic_approved" : "topic_rejected"},
        at,
      );
      const audit = this.auditEvent({
        workflowId,
        topicVersionId,
        eventType: decision === "approved" ? "topic_approved" : "topic_rejected",
        actor,
        at,
        payload: {
          approvalId: approval.id,
          idempotencyKey: normalizedKey,
          requestSha256,
          topicDependencySha256: version.dependencySha256,
          policyVersion: normalizedPolicy,
        },
      });
      await tx.insertDecision({workflow: next, approval, audit});
      return {
        approvalId: approval.id,
        workflowId,
        topicVersionId,
        decision,
        replayed: false,
      };
    });
  }

  async createRevision({workflowId, proposal, actor}) {
    requireAuthenticatedActor(actor);
    requireString(workflowId, "workflowId", {max: 100});
    const at = this.now();
    return this.repository.transaction(async (tx) => {
      const workflow = await tx.getWorkflowForUpdate(workflowId);
      if (!workflow) fail("NOT_FOUND", `Workflow not found: ${workflowId}`);
      const previous = await tx.getTopicVersion(workflow.currentTopicVersionId);
      if (!previous) {
        fail("NOT_FOUND", `Current topic version not found: ${workflow.currentTopicVersionId}`);
      }
      const records = this.buildVersionRecords({
        candidateId: workflow.topicCandidateId,
        versionNumber: previous.versionNumber + 1,
        proposal,
        actor,
        at,
      });
      const previousState = workflow.state;
      const next = updatedWorkflow(
        workflow,
        {state: "draft", currentTopicVersionId: records.version.id},
        at,
      );
      const auditEvents = [
        this.auditEvent({
          workflowId,
          topicVersionId: records.version.id,
          eventType: "topic_revision_created",
          actor,
          at,
          payload: {
            previousTopicVersionId: previous.id,
            artifactSha256: records.version.artifactSha256,
            dependencySha256: records.version.dependencySha256,
          },
        }),
      ];
      if (previousState !== "draft") {
        auditEvents.push(
          this.auditEvent({
            workflowId,
            topicVersionId: previous.id,
            eventType: "topic_approval_invalidated",
            actor,
            at,
            payload: {
              previousState,
              supersededByTopicVersionId: records.version.id,
              previousDependencySha256: previous.dependencySha256,
            },
          }),
        );
      }
      await tx.createRevision({workflow: next, ...records, auditEvents});
      return {
        workflowId,
        topicVersionId: records.version.id,
        versionNumber: records.version.versionNumber,
        artifactSha256: records.version.artifactSha256,
        dependencySha256: records.version.dependencySha256,
        state: next.state,
      };
    });
  }

  async getPendingReview({workflowId, actor}) {
    requireHumanApprover(actor);
    requireString(workflowId, "workflowId", {max: 100});
    const review = await this.repository.transaction((tx) => tx.getPendingReview(workflowId));
    if (!review) {
      fail("NO_PENDING_REVIEW", `No pending Topic Approval review for workflow ${workflowId}`);
    }
    return review;
  }
}
