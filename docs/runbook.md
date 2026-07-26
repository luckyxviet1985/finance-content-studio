# Operations runbook

## Operating principles

- Safety and approval integrity outrank throughput.
- PostgreSQL is authoritative for workflow state.
- Preserve evidence before remediation.
- External mutations must be reconciled before retry.
- Public publishing requires a distinct human Publisher approval.

## Standard project recovery

1. Identify project, workflow instance, current state, and last successful task.
2. Confirm database state and artifact checksums.
3. Classify the failure as transient, provider, validation, policy, data, or operator error.
4. Reconcile any external action using its idempotency key.
5. Retry only from a safe workflow boundary.
6. Record operator action and outcome in the audit trail.

## Approval-integrity incident

Examples: missing approval, approval attached to the wrong version, unauthorized approver, or transition bypass.

1. Freeze the workflow immediately.
2. Prevent upload or public-state changes.
3. Preserve audit, artifact, prompt, model, and tool records.
4. Identify affected projects and invalidate questionable approvals.
5. Escalate to Engineering, Compliance, and the Publisher owner.
6. Resume only after a documented incident decision.

## Accidental or incorrect YouTube publication

1. Reconcile the remote YouTube state.
2. Set the asset to private if authorized and operationally safe.
3. Freeze related workflows.
4. Notify the Publisher, Editorial, Compliance, and incident owner.
5. Preserve remote identifiers, timestamps, decisions, and logs.
6. Complete root-cause analysis before re-enabling publishing.

## Provider outage

1. Confirm provider health and rate-limit state.
2. Pause affected tasks and prevent retry storms.
3. Use a fallback only when the adapter policy authorizes it.
4. Validate output compatibility after failover.
5. Record cost and quality impact.

## Secret exposure

1. Revoke or rotate the credential.
2. Stop affected workers and integrations.
3. Identify logs, prompts, artifacts, and external calls containing the secret.
4. Contain access and follow the incident policy.
5. Add regression prevention before restoration.

## Milestone 1 operational exit

- Owners and escalation contacts assigned.
- Backup and restore approach documented.
- Approval-integrity and accidental-publish drills designed.
- SLOs and alert ownership approved.
- Provider and secret inventories established.