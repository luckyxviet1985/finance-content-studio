CREATE SCHEMA IF NOT EXISTS media_os;

CREATE TABLE media_os.workflow_instances (
  id uuid PRIMARY KEY,
  state text NOT NULL CHECK (
    state IN ('draft', 'pending_topic_approval', 'topic_approved', 'topic_rejected')
  ),
  topic_candidate_id uuid,
  current_topic_version_id uuid,
  lock_version bigint NOT NULL DEFAULT 0 CHECK (lock_version >= 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE media_os.topic_candidates (
  id uuid PRIMARY KEY,
  workflow_id uuid NOT NULL UNIQUE REFERENCES media_os.workflow_instances(id),
  created_by_type text NOT NULL CHECK (created_by_type IN ('human', 'agent', 'system')),
  created_by_id text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE media_os.topic_versions (
  id uuid PRIMARY KEY,
  topic_candidate_id uuid NOT NULL REFERENCES media_os.topic_candidates(id),
  version_number integer NOT NULL CHECK (version_number >= 1),
  content jsonb NOT NULL,
  artifact_sha256 char(64) NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  dependency_sha256 char(64) NOT NULL CHECK (dependency_sha256 ~ '^[a-f0-9]{64}$'),
  provenance jsonb NOT NULL,
  created_by_type text NOT NULL CHECK (created_by_type IN ('human', 'agent', 'system')),
  created_by_id text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (topic_candidate_id, version_number)
);

ALTER TABLE media_os.workflow_instances
  ADD CONSTRAINT workflow_topic_candidate_fk
  FOREIGN KEY (topic_candidate_id)
  REFERENCES media_os.topic_candidates(id)
  DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT workflow_current_topic_version_fk
  FOREIGN KEY (current_topic_version_id)
  REFERENCES media_os.topic_versions(id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE media_os.topic_evidence (
  id uuid PRIMARY KEY,
  topic_version_id uuid NOT NULL REFERENCES media_os.topic_versions(id),
  source_id text NOT NULL,
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  snapshot_artifact_id text NOT NULL,
  snapshot_sha256 char(64) NOT NULL CHECK (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz NOT NULL,
  provenance jsonb NOT NULL,
  UNIQUE (topic_version_id, source_id)
);

CREATE TABLE media_os.topic_scores (
  id uuid PRIMARY KEY,
  topic_version_id uuid NOT NULL UNIQUE REFERENCES media_os.topic_versions(id),
  score_version integer NOT NULL CHECK (score_version >= 1),
  overall_score numeric(5, 2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  dimensions jsonb NOT NULL,
  rationale text NOT NULL,
  producer_type text NOT NULL CHECK (producer_type IN ('human', 'agent', 'system')),
  producer_id text NOT NULL,
  prompt_provenance jsonb,
  model_provenance jsonb,
  tool_provenance jsonb,
  artifact_sha256 char(64) NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  policy_version text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE media_os.topic_approval_decisions (
  id uuid PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES media_os.workflow_instances(id),
  gate text NOT NULL CHECK (gate = 'topic'),
  topic_version_id uuid NOT NULL REFERENCES media_os.topic_versions(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  rationale text NOT NULL CHECK (length(btrim(rationale)) > 0),
  actor_type text NOT NULL CHECK (actor_type = 'human'),
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('editor', 'admin')),
  auth_source text NOT NULL,
  policy_version text NOT NULL,
  idempotency_key text NOT NULL,
  request_sha256 char(64) NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  topic_dependency_sha256 char(64) NOT NULL CHECK (topic_dependency_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL,
  UNIQUE (workflow_id, gate, idempotency_key),
  UNIQUE (workflow_id, gate, topic_version_id)
);

CREATE TABLE media_os.audit_events (
  id uuid PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES media_os.workflow_instances(id),
  topic_version_id uuid REFERENCES media_os.topic_versions(id),
  event_type text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
  actor_id text NOT NULL,
  actor_role text,
  auth_source text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX workflow_instances_pending_topic_idx
  ON media_os.workflow_instances(updated_at, id)
  WHERE state = 'pending_topic_approval';

CREATE INDEX topic_versions_candidate_idx
  ON media_os.topic_versions(topic_candidate_id, version_number DESC);

CREATE INDEX audit_events_workflow_idx
  ON media_os.audit_events(workflow_id, occurred_at, id);

CREATE OR REPLACE FUNCTION media_os.reject_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; create a new immutable version instead', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION media_os.validate_topic_approval_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  workflow_state text;
  current_version uuid;
  pinned_dependency char(64);
BEGIN
  SELECT state, current_topic_version_id
    INTO workflow_state, current_version
    FROM media_os.workflow_instances
    WHERE id = NEW.workflow_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workflow % does not exist', NEW.workflow_id USING ERRCODE = '23503';
  END IF;
  IF workflow_state <> 'pending_topic_approval' THEN
    RAISE EXCEPTION 'workflow % is not pending Topic Approval', NEW.workflow_id
      USING ERRCODE = '55000';
  END IF;
  IF current_version IS DISTINCT FROM NEW.topic_version_id THEN
    RAISE EXCEPTION 'topic version % is stale for workflow %', NEW.topic_version_id, NEW.workflow_id
      USING ERRCODE = '55000';
  END IF;

  SELECT dependency_sha256
    INTO pinned_dependency
    FROM media_os.topic_versions
    WHERE id = NEW.topic_version_id;
  IF pinned_dependency IS DISTINCT FROM NEW.topic_dependency_sha256 THEN
    RAISE EXCEPTION 'approval dependency hash does not match immutable topic version'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION media_os.validate_workflow_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_decision text;
BEGIN
  IF NEW.topic_candidate_id IS DISTINCT FROM OLD.topic_candidate_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'workflow identity and creation metadata are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF NEW.lock_version <> OLD.lock_version + 1 THEN
    RAISE EXCEPTION 'workflow lock_version must increment exactly once'
      USING ERRCODE = '40001';
  END IF;
  IF NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'workflow updated_at cannot move backwards'
      USING ERRCODE = '22007';
  END IF;

  IF OLD.state = 'draft'
     AND NEW.state = 'pending_topic_approval'
     AND NEW.current_topic_version_id = OLD.current_topic_version_id THEN
    RETURN NEW;
  END IF;

  IF NEW.state = 'draft'
     AND NEW.current_topic_version_id IS DISTINCT FROM OLD.current_topic_version_id THEN
    RETURN NEW;
  END IF;

  IF OLD.state = 'pending_topic_approval'
     AND NEW.state IN ('topic_approved', 'topic_rejected')
     AND NEW.current_topic_version_id = OLD.current_topic_version_id THEN
    expected_decision := CASE NEW.state
      WHEN 'topic_approved' THEN 'approved'
      ELSE 'rejected'
    END;
    IF EXISTS (
      SELECT 1
        FROM media_os.topic_approval_decisions
       WHERE workflow_id = NEW.id
         AND topic_version_id = NEW.current_topic_version_id
         AND decision = expected_decision
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'workflow decision state requires its immutable Topic Approval record'
      USING ERRCODE = '55000';
  END IF;

  RAISE EXCEPTION 'invalid Topic Approval workflow transition: % to %', OLD.state, NEW.state
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION media_os.validate_workflow_topic_ownership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM media_os.topic_candidates candidate
      JOIN media_os.topic_versions version
        ON version.topic_candidate_id = candidate.id
     WHERE candidate.id = NEW.topic_candidate_id
       AND candidate.workflow_id = NEW.id
       AND version.id = NEW.current_topic_version_id
  ) THEN
    RAISE EXCEPTION 'workflow topic candidate and current version must belong to the same workflow'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_topic_approval_before_insert
  BEFORE INSERT ON media_os.topic_approval_decisions
  FOR EACH ROW EXECUTE FUNCTION media_os.validate_topic_approval_insert();

CREATE TRIGGER validate_workflow_before_update
  BEFORE UPDATE ON media_os.workflow_instances
  FOR EACH ROW EXECUTE FUNCTION media_os.validate_workflow_transition();

CREATE CONSTRAINT TRIGGER validate_workflow_topic_ownership_after_change
  AFTER INSERT OR UPDATE ON media_os.workflow_instances
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION media_os.validate_workflow_topic_ownership();

CREATE TRIGGER topic_candidates_append_only
  BEFORE UPDATE OR DELETE ON media_os.topic_candidates
  FOR EACH ROW EXECUTE FUNCTION media_os.reject_immutable_mutation();
CREATE TRIGGER topic_versions_append_only
  BEFORE UPDATE OR DELETE ON media_os.topic_versions
  FOR EACH ROW EXECUTE FUNCTION media_os.reject_immutable_mutation();
CREATE TRIGGER topic_evidence_append_only
  BEFORE UPDATE OR DELETE ON media_os.topic_evidence
  FOR EACH ROW EXECUTE FUNCTION media_os.reject_immutable_mutation();
CREATE TRIGGER topic_scores_append_only
  BEFORE UPDATE OR DELETE ON media_os.topic_scores
  FOR EACH ROW EXECUTE FUNCTION media_os.reject_immutable_mutation();
CREATE TRIGGER topic_approval_decisions_append_only
  BEFORE UPDATE OR DELETE ON media_os.topic_approval_decisions
  FOR EACH ROW EXECUTE FUNCTION media_os.reject_immutable_mutation();
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON media_os.audit_events
  FOR EACH ROW EXECUTE FUNCTION media_os.reject_immutable_mutation();

ALTER TABLE media_os.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_os.topic_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_os.topic_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_os.topic_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_os.topic_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_os.topic_approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_os.audit_events ENABLE ROW LEVEL SECURITY;
