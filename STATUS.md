# Project status

Last updated: 2026-08-28

## Current milestone
Milestone 1 — Decisions and delivery foundation

## State
In progress

## Completed
- GitHub connector and repository access verified.
- Architecture package approved.
- Hosting, data platform, region, orchestration approach, providers, jurisdiction, retention, capacity, and vertical-slice priority approved.
- Four mandatory human approval gates established.
- Initial ADRs, risk register, backlog, and runbook recorded.
- Documentary Factory proof-of-concept package added on `feature/documentary-fdr-prototype` for **The Week America Closed Every Bank**.
- Prototype includes a versioned project manifest, 72-second scene timeline, source/rights ledger, provider-neutral voice slot, media-ingestion contract, and Remotion composition scaffold.

## In progress
- Updating tracking to the approved vertical-slice plan.
- Establishing repository and implementation foundation.
- Building persisted workflow, evidence, and topic-approval primitives.
- Issue #7: ingest approved FDR/Library of Congress media, generate test narration, and complete the first deterministic documentary render after the render worker/application scaffold exists.

## External setup needed before later stages
- Supabase project credentials
- OpenAI API credential
- YouTube OAuth client and target channel authorization
- Render service connection

These do not block local foundation work or documentary manifest/source preparation.

## Next approval gate
A functioning Topic Approval checkpoint with persisted topic evidence, score, workflow state, and immutable approval record.
