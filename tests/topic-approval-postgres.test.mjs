import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {PGlite} from "@electric-sql/pglite";

import {applyMigrations} from "../src/database/migrations.mjs";
import {PostgresTopicApprovalRepository} from "../src/topic-approval/postgres-repository.mjs";
import {TopicApprovalService} from "../src/topic-approval/service.mjs";

const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../supabase/migrations",
);

const actor = {
  type: "human",
  id: "integration-editor",
  role: "editor",
  authenticated: true,
  authSource: "integration-test-auth-boundary",
};

const proposal = {
  title: "The Week America Closed Every Bank",
  thesis: "The 1933 bank holiday paired emergency banking action with restored confidence.",
  audience: "United States general finance audience",
  format: "archival-documentary-short",
  evidence: [
    {
      sourceId: "loc-bank-holiday-context",
      sourceUrl: "https://guides.loc.gov/this-month-in-business-history/march/1933-bank-holiday",
      snapshotArtifactId: "loc-bank-holiday-snapshot-v1",
      snapshotSha256: "1".repeat(64),
      capturedAt: "2026-08-29T02:00:00.000Z",
      provenance: {publisher: "Library of Congress", retrievalTool: "integration-test"},
    },
  ],
  score: {
    scoreVersion: 1,
    overallScore: 91,
    dimensions: {authority: 95, audienceFit: 90, visualPotential: 88},
    rationale: "Primary archival material supports a bounded educational documentary.",
    producer: {type: "agent", id: "integration-score-agent"},
    promptProvenance: {promptId: "topic-score-v1", promptSha256: "2".repeat(64)},
    modelProvenance: {provider: "test", model: "deterministic-fixture", modelVersion: "1"},
    toolProvenance: {tool: "integration-test", version: "1"},
  },
  provenance: {
    policyVersion: "educational-us-finance-v1",
    prompt: {promptId: "topic-proposal-v1", promptSha256: "3".repeat(64)},
    model: {provider: "test", model: "deterministic-fixture", modelVersion: "1"},
    tool: {tool: "integration-test", version: "1"},
  },
};

const createPoolBridge = (database) => ({
  async connect() {
    return {
      query: async (sql, params) => {
        if (params === undefined && sql.includes(";")) {
          const results = await database.exec(sql);
          return results.at(-1) ?? {rows: [], rowCount: 0};
        }
        return database.query(sql, params);
      },
      release() {},
    };
  },
});

test("PostgreSQL migration and adapter persist a guarded Topic Approval flow", async (context) => {
  const database = new PGlite();
  context.after(() => database.close());
  const pool = createPoolBridge(database);

  const firstMigration = await applyMigrations({pool, migrationsDirectory});
  assert.equal(firstMigration.applied.length, 1);
  const replayedMigration = await applyMigrations({pool, migrationsDirectory});
  assert.deepEqual(replayedMigration.applied, []);
  assert.deepEqual(replayedMigration.skipped, firstMigration.applied);

  let sequence = 0;
  const repository = new PostgresTopicApprovalRepository({pool});
  const service = new TopicApprovalService({
    repository,
    now: () => "2026-08-29T02:30:00.000Z",
    idFactory: () =>
      `10000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  });

  const draft = await service.createDraft({proposal, actor});
  await service.submitForApproval({
    workflowId: draft.workflowId,
    topicVersionId: draft.topicVersionId,
    actor,
  });
  const decision = await service.decide({
    workflowId: draft.workflowId,
    topicVersionId: draft.topicVersionId,
    decision: "approved",
    rationale: "The evidence and educational framing are adequate for this prototype.",
    idempotencyKey: "integration-topic-approval-v1",
    policyVersion: "topic-approval-policy-v1",
    actor,
  });

  assert.equal(decision.replayed, false);
  const persisted = await database.query(
    `SELECT state, lock_version FROM media_os.workflow_instances WHERE id = $1`,
    [draft.workflowId],
  );
  assert.deepEqual(persisted.rows[0], {state: "topic_approved", lock_version: 2});
  const decisions = await database.query(
    `SELECT actor_type, actor_role, topic_version_id, topic_dependency_sha256
       FROM media_os.topic_approval_decisions WHERE workflow_id = $1`,
    [draft.workflowId],
  );
  assert.equal(decisions.rows.length, 1);
  assert.equal(decisions.rows[0].actor_type, "human");
  assert.equal(decisions.rows[0].actor_role, "editor");
  assert.equal(decisions.rows[0].topic_version_id, draft.topicVersionId);
  assert.equal(decisions.rows[0].topic_dependency_sha256.trim(), draft.dependencySha256);

  const audit = await database.query(
    `SELECT event_type FROM media_os.audit_events
      WHERE workflow_id = $1 ORDER BY occurred_at, id`,
    [draft.workflowId],
  );
  assert.deepEqual(
    new Set(audit.rows.map(({event_type: eventType}) => eventType)),
    new Set(["topic_draft_created", "topic_submitted_for_approval", "topic_approved"]),
  );

  await assert.rejects(
    () =>
      database.query(
        `UPDATE media_os.topic_approval_decisions SET rationale = 'tampered' WHERE id = $1`,
        [decision.approvalId],
      ),
    /append-only/,
  );
  await assert.rejects(
    () =>
      database.query(
        `UPDATE media_os.workflow_instances
            SET state = 'topic_rejected', lock_version = lock_version + 1
          WHERE id = $1`,
        [draft.workflowId],
      ),
    /invalid Topic Approval workflow transition/,
  );
});
