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

## Topic Approval operation and recovery

1. Apply versioned migrations from a trusted backend environment and confirm no checksum drift is reported.
2. Create or revise a topic proposal with immutable evidence snapshots, score provenance, and policy provenance, then submit the exact current version for review.
3. Confirm the pending view shows the intended version ID and dependency SHA-256 before deciding. Only an authenticated human editor or admin may continue.
4. Use one stable idempotency key per intended decision. An exact retry is safe; a conflict indicates different request content and must be investigated.
5. If content, evidence, score, or policy changes, create a revision. Confirm the workflow returns to `draft` and obtain a new decision; never reuse the old approval.
6. If a direct mutation or illegal transition is reported, freeze the workflow and preserve the error and audit records. Do not bypass the database trigger.
7. Reconcile the workflow, immutable decision, pinned dependency hash, and ordered audit events before resuming downstream work.

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

## Documentary archival ingestion
1. Validate the immutable project bundle and confirm its Topic approval record pins the intended project/source version.
2. Confirm every downloadable source has a human rights decision with reviewer, decision ID, timestamp, intended use, and evidence URL. A source claim alone is insufficient.
3. Run the deterministic ingestion command. It permits only exact HTTPS origins/path prefixes, rejects redirects and credentials, enforces pinned byte length/media type/SHA-256, refuses overwrite, and writes a provenance receipt beside each asset.
4. If a source has changed, do not update a checksum in place. Stop, review the new source bytes and rights metadata, and create a new project/source-ledger version.
5. If an asset exists without its receipt, quarantine it and re-ingest from the last approved immutable version; do not reconstruct provenance by hand.

## Documentary render recovery and QC
1. Re-run project validation and confirm Topic and Script approvals pin current immutable versions.
2. Confirm required audio slots are `ready` with artifact versions and SHA-256 checksums. Provider changes create a new audio-slots version.
3. Build render props from the validated bundle; never hand-edit generated props.
4. Render with the pinned Remotion/React versions and record the installed FFmpeg version.
5. Run render verification. It must confirm duration, resolution, frame rate, audio presence, output checksum, dependency checksums, and approval IDs.
6. Visually inspect representative frames, captions, archival crop/motion, and the FDR excerpt; audibly verify the excerpt against the approved transcript.
7. Request Final Video approval against the verified video checksum. Rendering does not confer approval and this prototype contains no publishing action.
