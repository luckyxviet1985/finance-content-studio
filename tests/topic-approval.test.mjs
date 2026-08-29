import assert from "node:assert/strict";
import test from "node:test";

import {TopicApprovalService} from "../src/topic-approval/service.mjs";

const humanEditor = {
  type: "human",
  id: "editor-1",
  role: "editor",
  authenticated: true,
  authSource: "test-auth-boundary",
};

const agentActor = {
  type: "agent",
  id: "topic-agent-1",
  role: "proposer",
  authenticated: true,
  authSource: "agent-runtime",
};

const proposal = (title = "The Week America Closed Every Bank") => ({
  title,
  thesis: "The 1933 bank holiday worked because liquidity and public confidence moved together.",
  audience: "United States general finance audience",
  format: "archival-documentary-short",
  evidence: [
    {
      sourceId: "loc-bank-holiday-context",
      sourceUrl: "https://guides.loc.gov/this-month-in-business-history/march/1933-bank-holiday",
      snapshotArtifactId: "artifact-source-snapshot-v1",
      snapshotSha256: "1".repeat(64),
      capturedAt: "2026-08-29T02:00:00.000Z",
      provenance: {publisher: "Library of Congress", retrievalTool: "media-os-source-capture-v1"},
    },
  ],
  score: {
    scoreVersion: 1,
    overallScore: 91,
    dimensions: {authority: 95, audienceFit: 90, visualPotential: 88},
    rationale: "Primary archival material and a clear finance mechanism support a short documentary.",
    producer: {type: "agent", id: "topic-score-agent-1"},
    promptProvenance: {promptId: "topic-score-v1", promptSha256: "2".repeat(64)},
    modelProvenance: {provider: "test", model: "test-model", modelVersion: "1"},
    toolProvenance: {tool: "topic-score-contract-test", version: "1"},
  },
  provenance: {
    policyVersion: "educational-us-finance-v1",
    prompt: {promptId: "topic-proposal-v1", promptSha256: "3".repeat(64)},
    model: {provider: "test", model: "test-model", modelVersion: "1"},
    tool: {tool: "topic-proposal-contract-test", version: "1"},
  },
});

class MemoryTopicApprovalRepository {
  constructor() {
    this.workflows = new Map();
    this.candidates = new Map();
    this.versions = new Map();
    this.evidence = new Map();
    this.scores = new Map();
    this.approvals = new Map();
    this.idempotency = new Map();
    this.audit = [];
  }

  async transaction(operation) {
    return operation(this);
  }

  async createInitialDraft(record) {
    this.workflows.set(record.workflow.id, structuredClone(record.workflow));
    this.candidates.set(record.candidate.id, structuredClone(record.candidate));
    this.versions.set(record.version.id, structuredClone(record.version));
    this.evidence.set(record.version.id, structuredClone(record.evidence));
    this.scores.set(record.version.id, structuredClone(record.score));
    this.audit.push(structuredClone(record.audit));
  }

  async getWorkflowForUpdate(workflowId) {
    return structuredClone(this.workflows.get(workflowId) ?? null);
  }

  async getTopicVersion(topicVersionId) {
    return structuredClone(this.versions.get(topicVersionId) ?? null);
  }

  async submitForApproval({workflow, audit}) {
    this.workflows.set(workflow.id, structuredClone(workflow));
    this.audit.push(structuredClone(audit));
  }

  async getDecisionByIdempotency(workflowId, idempotencyKey) {
    const id = this.idempotency.get(`${workflowId}:${idempotencyKey}`);
    return structuredClone(id ? this.approvals.get(id) : null);
  }

  async insertDecision({workflow, approval, audit}) {
    this.workflows.set(workflow.id, structuredClone(workflow));
    this.approvals.set(approval.id, structuredClone(approval));
    this.idempotency.set(
      `${approval.workflowId}:${approval.idempotencyKey}`,
      approval.id,
    );
    this.audit.push(structuredClone(audit));
  }

  async createRevision({workflow, version, evidence, score, auditEvents}) {
    this.workflows.set(workflow.id, structuredClone(workflow));
    this.versions.set(version.id, structuredClone(version));
    this.evidence.set(version.id, structuredClone(evidence));
    this.scores.set(version.id, structuredClone(score));
    this.audit.push(...structuredClone(auditEvents));
  }

  async getPendingReview(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.state !== "pending_topic_approval") return null;
    const version = this.versions.get(workflow.currentTopicVersionId);
    return structuredClone({
      workflow,
      version,
      evidence: this.evidence.get(version.id),
      score: this.scores.get(version.id),
    });
  }
}

const createHarness = () => {
  let sequence = 0;
  const repository = new MemoryTopicApprovalRepository();
  const service = new TopicApprovalService({
    repository,
    now: () => "2026-08-29T02:30:00.000Z",
    idFactory: () =>
      `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  });
  return {repository, service};
};

const expectCode = (code) => (error) => {
  assert.equal(error.code, code);
  return true;
};

const createPending = async (service) => {
  const draft = await service.createDraft({proposal: proposal(), actor: agentActor});
  await service.submitForApproval({
    workflowId: draft.workflowId,
    topicVersionId: draft.topicVersionId,
    actor: humanEditor,
  });
  return draft;
};

test("persists an immutable topic proposal and exposes a pending review", async () => {
  const {repository, service} = createHarness();
  const draft = await service.createDraft({proposal: proposal(), actor: agentActor});

  assert.equal(repository.workflows.get(draft.workflowId).state, "draft");
  await service.submitForApproval({
    workflowId: draft.workflowId,
    topicVersionId: draft.topicVersionId,
    actor: humanEditor,
  });
  const review = await service.getPendingReview({
    workflowId: draft.workflowId,
    actor: humanEditor,
  });

  assert.equal(review.version.content.title, proposal().title);
  assert.equal(review.evidence.length, 1);
  assert.equal(review.score.overallScore, 91);
  assert.match(review.version.artifactSha256, /^[a-f0-9]{64}$/);
  assert.match(review.version.dependencySha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(repository.audit.map((event) => event.eventType), [
    "topic_draft_created",
    "topic_submitted_for_approval",
  ]);
});

test("a trusted human editor can approve the exact pending version", async () => {
  const {repository, service} = createHarness();
  const draft = await createPending(service);

  const result = await service.decide({
    workflowId: draft.workflowId,
    topicVersionId: draft.topicVersionId,
    decision: "approved",
    rationale: "Strong evidence, clear educational value, and a bounded documentary scope.",
    idempotencyKey: "topic-approval-fdr-v1",
    policyVersion: "topic-approval-policy-v1",
    actor: humanEditor,
  });

  assert.equal(result.decision, "approved");
  assert.equal(result.replayed, false);
  assert.equal(repository.workflows.get(draft.workflowId).state, "topic_approved");
  const approval = repository.approvals.get(result.approvalId);
  assert.equal(approval.topicVersionId, draft.topicVersionId);
  assert.equal(approval.topicDependencySha256, draft.dependencySha256);
  assert.equal(approval.actorType, "human");
});

test("agent and unauthenticated identities cannot decide", async () => {
  const {service} = createHarness();
  const draft = await createPending(service);
  const input = {
    workflowId: draft.workflowId,
    topicVersionId: draft.topicVersionId,
    decision: "approved",
    rationale: "Attempted automated approval must be rejected.",
    idempotencyKey: "unauthorized-decision-v1",
    policyVersion: "topic-approval-policy-v1",
  };

  await assert.rejects(
    () => service.decide({...input, actor: agentActor}),
    expectCode("UNAUTHORIZED_APPROVER"),
  );
  await assert.rejects(
    () =>
      service.decide({
        ...input,
        actor: {...humanEditor, authenticated: false},
      }),
    expectCode("UNAUTHORIZED_APPROVER"),
  );
});

test("same idempotency key replays the decision and conflicting reuse fails", async () => {
  const {repository, service} = createHarness();
  const draft = await createPending(service);
  const input = {
    workflowId: draft.workflowId,
    topicVersionId: draft.topicVersionId,
    decision: "approved",
    rationale: "This exact request should be safe to replay.",
    idempotencyKey: "replay-topic-decision-v1",
    policyVersion: "topic-approval-policy-v1",
    actor: humanEditor,
  };

  const original = await service.decide(input);
  const replay = await service.decide(input);
  assert.equal(replay.approvalId, original.approvalId);
  assert.equal(replay.replayed, true);
  assert.equal(repository.approvals.size, 1);

  await assert.rejects(
    () =>
      service.decide({
        ...input,
        decision: "rejected",
        rationale: "Conflicting use of the same key.",
      }),
    expectCode("IDEMPOTENCY_CONFLICT"),
  );
});

test("a trusted human can reject a pending topic", async () => {
  const {repository, service} = createHarness();
  const draft = await createPending(service);

  const result = await service.decide({
    workflowId: draft.workflowId,
    topicVersionId: draft.topicVersionId,
    decision: "rejected",
    rationale: "The evidence package needs a stronger primary-source snapshot.",
    idempotencyKey: "reject-topic-v1",
    policyVersion: "topic-approval-policy-v1",
    actor: humanEditor,
  });

  assert.equal(result.decision, "rejected");
  assert.equal(repository.workflows.get(draft.workflowId).state, "topic_rejected");
});

test("decision is impossible before submission", async () => {
  const {service} = createHarness();
  const draft = await service.createDraft({proposal: proposal(), actor: agentActor});

  await assert.rejects(
    () =>
      service.decide({
        workflowId: draft.workflowId,
        topicVersionId: draft.topicVersionId,
        decision: "approved",
        rationale: "A draft cannot be approved before explicit submission.",
        idempotencyKey: "premature-topic-approval-v1",
        policyVersion: "topic-approval-policy-v1",
        actor: humanEditor,
      }),
    expectCode("INVALID_TRANSITION"),
  );
});

test("a material revision invalidates the old decision and requires a new approval", async () => {
  const {repository, service} = createHarness();
  const first = await createPending(service);
  await service.decide({
    workflowId: first.workflowId,
    topicVersionId: first.topicVersionId,
    decision: "approved",
    rationale: "Version one is approved on its exact dependency hash.",
    idempotencyKey: "approve-topic-before-revision-v1",
    policyVersion: "topic-approval-policy-v1",
    actor: humanEditor,
  });

  const revision = await service.createRevision({
    workflowId: first.workflowId,
    proposal: proposal("How Roosevelt Rebuilt Trust in America's Banks"),
    actor: agentActor,
  });

  assert.equal(revision.versionNumber, 2);
  assert.notEqual(revision.dependencySha256, first.dependencySha256);
  assert.equal(repository.workflows.get(first.workflowId).state, "draft");
  assert.equal(repository.approvals.size, 1, "old decision remains immutable for audit");
  assert.equal(repository.workflows.get(first.workflowId).currentTopicVersionId, revision.topicVersionId);

  await service.submitForApproval({
    workflowId: first.workflowId,
    topicVersionId: revision.topicVersionId,
    actor: humanEditor,
  });
  await assert.rejects(
    () =>
      service.decide({
        workflowId: first.workflowId,
        topicVersionId: first.topicVersionId,
        decision: "approved",
        rationale: "A stale version must never receive the current workflow decision.",
        idempotencyKey: "stale-topic-decision-v1",
        policyVersion: "topic-approval-policy-v1",
        actor: humanEditor,
      }),
    expectCode("STALE_TOPIC_VERSION"),
  );
  assert.ok(
    repository.audit.some((event) => event.eventType === "topic_approval_invalidated"),
  );
});

test("pending review data is restricted to trusted human operators", async () => {
  const {service} = createHarness();
  const draft = await createPending(service);

  await assert.rejects(
    () => service.getPendingReview({workflowId: draft.workflowId, actor: agentActor}),
    expectCode("UNAUTHORIZED_APPROVER"),
  );
});

test("untrusted proposal data must be bounded JSON with HTTPS evidence", async () => {
  const {service} = createHarness();
  const unsafeProvenance = {};
  unsafeProvenance.self = unsafeProvenance;

  await assert.rejects(
    () =>
      service.createDraft({
        proposal: {
          ...proposal(),
          evidence: [
            {
              ...proposal().evidence[0],
              sourceUrl: "http://example.test/source",
            },
          ],
        },
        actor: agentActor,
      }),
    expectCode("INVALID_INPUT"),
  );
  await assert.rejects(
    () =>
      service.createDraft({
        proposal: {...proposal(), provenance: {...proposal().provenance, tool: unsafeProvenance}},
        actor: agentActor,
      }),
    expectCode("INVALID_INPUT"),
  );
});
