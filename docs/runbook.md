# Operations runbook

## Deployment topology
- Render US East: web service, general worker, render worker
- Supabase: Postgres, Auth, Storage
- OpenAI: Responses, image generation, audio
- YouTube: Data and Analytics APIs
- Remotion and FFmpeg: deterministic video assembly

## Local/application recovery
1. Identify project, workflow instance, state, and last successful task.
2. Confirm Supabase database state and artifact checksums.
3. Classify the failure: transient, provider, validation, policy, data, or operator.
4. Reconcile external actions using idempotency keys.
5. Retry only from a safe workflow boundary.
6. Audit the operator action and outcome.

## Approval-integrity incident
1. Freeze the workflow.
2. Block upload and public-state changes.
3. Preserve audit, artifact, prompt, model, source, and tool records.
4. Invalidate approvals attached to changed or uncertain versions.
5. Escalate to Engineering and Compliance.
6. Resume only after a documented decision.

## Incorrect YouTube publication
1. Reconcile remote state.
2. Set private if authorized and safe.
3. Freeze related workflows.
4. Notify Publisher, Editorial, Compliance, and incident owner.
5. Preserve identifiers, timestamps, decisions, and logs.
6. Complete root-cause analysis before re-enabling publishing.

## OpenAI/provider outage
1. Confirm provider health and rate-limit state.
2. Pause tasks and prevent retry storms.
3. Do not change providers outside the approved adapter policy.
4. Validate output compatibility after recovery.
5. Record cost and quality impact.

## Secret exposure
1. Revoke or rotate the credential.
2. Stop affected Render services and integrations.
3. Identify logs, prompts, artifacts, and calls containing the secret.
4. Contain access and follow incident policy.
5. Add regression prevention before restoration.

## Capacity posture
Scale web, general worker, and render worker independently. Initial target is two long-form and five Shorts weekly; capacity planning must support one long-form and three Shorts daily without changing domain architecture.