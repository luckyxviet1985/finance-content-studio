const json = (value) => JSON.stringify(value);

const mapWorkflow = (row) =>
  row
    ? {
        id: row.id,
        state: row.state,
        topicCandidateId: row.topic_candidate_id,
        currentTopicVersionId: row.current_topic_version_id,
        lockVersion: Number(row.lock_version),
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      }
    : null;

const mapVersion = (row) =>
  row
    ? {
        id: row.id,
        topicCandidateId: row.topic_candidate_id,
        versionNumber: row.version_number,
        content: row.content,
        artifactSha256: row.artifact_sha256.trim(),
        dependencySha256: row.dependency_sha256.trim(),
        provenance: row.provenance,
        createdByType: row.created_by_type,
        createdById: row.created_by_id,
        createdAt: new Date(row.created_at).toISOString(),
      }
    : null;

const mapApproval = (row) =>
  row
    ? {
        id: row.id,
        workflowId: row.workflow_id,
        gate: row.gate,
        topicVersionId: row.topic_version_id,
        decision: row.decision,
        rationale: row.rationale,
        actorType: row.actor_type,
        actorId: row.actor_id,
        actorRole: row.actor_role,
        authSource: row.auth_source,
        policyVersion: row.policy_version,
        idempotencyKey: row.idempotency_key,
        requestSha256: row.request_sha256.trim(),
        topicDependencySha256: row.topic_dependency_sha256.trim(),
        createdAt: new Date(row.created_at).toISOString(),
      }
    : null;

class PostgresTopicApprovalTransaction {
  constructor(client) {
    this.client = client;
  }

  async insertWorkflow(workflow) {
    await this.client.query(
      `INSERT INTO media_os.workflow_instances
        (id, state, topic_candidate_id, current_topic_version_id, lock_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        workflow.id,
        workflow.state,
        workflow.topicCandidateId,
        workflow.currentTopicVersionId,
        workflow.lockVersion,
        workflow.createdAt,
        workflow.updatedAt,
      ],
    );
  }

  async insertCandidate(candidate) {
    await this.client.query(
      `INSERT INTO media_os.topic_candidates
        (id, workflow_id, created_by_type, created_by_id, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        candidate.id,
        candidate.workflowId,
        candidate.createdByType,
        candidate.createdById,
        candidate.createdAt,
      ],
    );
  }

  async insertVersion(version) {
    await this.client.query(
      `INSERT INTO media_os.topic_versions
        (id, topic_candidate_id, version_number, content, artifact_sha256,
         dependency_sha256, provenance, created_by_type, created_by_id, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9, $10)`,
      [
        version.id,
        version.topicCandidateId,
        version.versionNumber,
        json(version.content),
        version.artifactSha256,
        version.dependencySha256,
        json(version.provenance),
        version.createdByType,
        version.createdById,
        version.createdAt,
      ],
    );
  }

  async insertEvidence(evidence) {
    for (const item of evidence) {
      await this.client.query(
        `INSERT INTO media_os.topic_evidence
          (id, topic_version_id, source_id, source_url, snapshot_artifact_id,
           snapshot_sha256, captured_at, provenance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          item.id,
          item.topicVersionId,
          item.sourceId,
          item.sourceUrl,
          item.snapshotArtifactId,
          item.snapshotSha256,
          item.capturedAt,
          json(item.provenance),
        ],
      );
    }
  }

  async insertScore(score) {
    await this.client.query(
      `INSERT INTO media_os.topic_scores
        (id, topic_version_id, score_version, overall_score, dimensions, rationale,
         producer_type, producer_id, prompt_provenance, model_provenance,
         tool_provenance, artifact_sha256, policy_version, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10::jsonb,
               $11::jsonb, $12, $13, $14)`,
      [
        score.id,
        score.topicVersionId,
        score.scoreVersion,
        score.overallScore,
        json(score.dimensions),
        score.rationale,
        score.producer.type,
        score.producer.id,
        json(score.promptProvenance),
        json(score.modelProvenance),
        json(score.toolProvenance),
        score.artifactSha256,
        score.policyVersion,
        score.createdAt,
      ],
    );
  }

  async insertAudit(audit) {
    await this.client.query(
      `INSERT INTO media_os.audit_events
        (id, workflow_id, topic_version_id, event_type, actor_type, actor_id,
         actor_role, auth_source, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        audit.id,
        audit.workflowId,
        audit.topicVersionId,
        audit.eventType,
        audit.actorType,
        audit.actorId,
        audit.actorRole,
        audit.authSource,
        json(audit.payload),
        audit.occurredAt,
      ],
    );
  }

  async updateWorkflow(workflow) {
    const result = await this.client.query(
      `UPDATE media_os.workflow_instances
          SET state = $2,
              current_topic_version_id = $3,
              lock_version = $4,
              updated_at = $5
        WHERE id = $1 AND lock_version = $6`,
      [
        workflow.id,
        workflow.state,
        workflow.currentTopicVersionId,
        workflow.lockVersion,
        workflow.updatedAt,
        workflow.lockVersion - 1,
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error(`Concurrent workflow update detected: ${workflow.id}`);
    }
  }

  async createInitialDraft({workflow, candidate, version, evidence, score, audit}) {
    await this.insertWorkflow(workflow);
    await this.insertCandidate(candidate);
    await this.insertVersion(version);
    await this.insertEvidence(evidence);
    await this.insertScore(score);
    await this.insertAudit(audit);
  }

  async getWorkflowForUpdate(workflowId) {
    const result = await this.client.query(
      `SELECT * FROM media_os.workflow_instances WHERE id = $1 FOR UPDATE`,
      [workflowId],
    );
    return mapWorkflow(result.rows[0]);
  }

  async getTopicVersion(topicVersionId) {
    const result = await this.client.query(
      `SELECT * FROM media_os.topic_versions WHERE id = $1`,
      [topicVersionId],
    );
    return mapVersion(result.rows[0]);
  }

  async submitForApproval({workflow, audit}) {
    await this.updateWorkflow(workflow);
    await this.insertAudit(audit);
  }

  async getDecisionByIdempotency(workflowId, idempotencyKey) {
    const result = await this.client.query(
      `SELECT *
         FROM media_os.topic_approval_decisions
        WHERE workflow_id = $1 AND gate = 'topic' AND idempotency_key = $2`,
      [workflowId, idempotencyKey],
    );
    return mapApproval(result.rows[0]);
  }

  async insertDecision({workflow, approval, audit}) {
    await this.client.query(
      `INSERT INTO media_os.topic_approval_decisions
        (id, workflow_id, gate, topic_version_id, decision, rationale,
         actor_type, actor_id, actor_role, auth_source, policy_version,
         idempotency_key, request_sha256, topic_dependency_sha256, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        approval.id,
        approval.workflowId,
        approval.gate,
        approval.topicVersionId,
        approval.decision,
        approval.rationale,
        approval.actorType,
        approval.actorId,
        approval.actorRole,
        approval.authSource,
        approval.policyVersion,
        approval.idempotencyKey,
        approval.requestSha256,
        approval.topicDependencySha256,
        approval.createdAt,
      ],
    );
    await this.updateWorkflow(workflow);
    await this.insertAudit(audit);
  }

  async createRevision({workflow, version, evidence, score, auditEvents}) {
    await this.insertVersion(version);
    await this.insertEvidence(evidence);
    await this.insertScore(score);
    await this.updateWorkflow(workflow);
    for (const audit of auditEvents) await this.insertAudit(audit);
  }

  async getPendingReview(workflowId) {
    const workflowResult = await this.client.query(
      `SELECT *
         FROM media_os.workflow_instances
        WHERE id = $1 AND state = 'pending_topic_approval'`,
      [workflowId],
    );
    const workflow = mapWorkflow(workflowResult.rows[0]);
    if (!workflow) return null;

    const versionResult = await this.client.query(
      `SELECT * FROM media_os.topic_versions WHERE id = $1`,
      [workflow.currentTopicVersionId],
    );
    const evidenceResult = await this.client.query(
      `SELECT *
         FROM media_os.topic_evidence
        WHERE topic_version_id = $1
        ORDER BY source_id`,
      [workflow.currentTopicVersionId],
    );
    const scoreResult = await this.client.query(
      `SELECT * FROM media_os.topic_scores WHERE topic_version_id = $1`,
      [workflow.currentTopicVersionId],
    );
    const score = scoreResult.rows[0];
    return {
      workflow,
      version: mapVersion(versionResult.rows[0]),
      evidence: evidenceResult.rows.map((row) => ({
        id: row.id,
        topicVersionId: row.topic_version_id,
        sourceId: row.source_id,
        sourceUrl: row.source_url,
        snapshotArtifactId: row.snapshot_artifact_id,
        snapshotSha256: row.snapshot_sha256.trim(),
        capturedAt: new Date(row.captured_at).toISOString(),
        provenance: row.provenance,
      })),
      score: {
        id: score.id,
        topicVersionId: score.topic_version_id,
        scoreVersion: score.score_version,
        overallScore: Number(score.overall_score),
        dimensions: score.dimensions,
        rationale: score.rationale,
        producer: {type: score.producer_type, id: score.producer_id},
        promptProvenance: score.prompt_provenance,
        modelProvenance: score.model_provenance,
        toolProvenance: score.tool_provenance,
        artifactSha256: score.artifact_sha256.trim(),
        policyVersion: score.policy_version,
        createdAt: new Date(score.created_at).toISOString(),
      },
    };
  }
}

export class PostgresTopicApprovalRepository {
  constructor({pool}) {
    if (!pool?.connect) throw new Error("PostgresTopicApprovalRepository requires a pg Pool");
    this.pool = pool;
  }

  async transaction(operation) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const result = await operation(new PostgresTopicApprovalTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
