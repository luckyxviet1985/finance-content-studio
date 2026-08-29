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
- Issue #8 FDR Documentary Factory prototype scaffold completed on a review branch: immutable project bundle, 70-second scene timeline, archival rights ledger, provider-neutral audio slots, deterministic media-ingestion contract, Remotion composition, and contract tests.
- Issue #12 Topic Approval vertical slice completed on a review branch: versioned PostgreSQL migration, immutable topic/evidence/score records, guarded workflow transitions, human-only decisions, idempotency handling, audit history, local operator command, and database integration tests.

## In progress
- Updating tracking to the approved vertical-slice plan.
- Establishing repository and implementation foundation.
- Reviewing and integrating the persisted Topic Approval checkpoint from issue #12.
- Reviewing and integrating issue #8 without advancing its pending Topic, Script, Final Video, or Public Publishing approvals.

## Documentary prototype readiness
- Project: `the-week-america-closed-every-bank` version 1.
- Structurally validated; rendering is blocked by design.
- Pending human actions: Topic approval, rights review for three archival assets, Script approval, narration selection/generation, and post-render Final Video approval.
- Public publishing, ElevenLabs production integration, multi-channel support, and dashboard work remain disabled/out of scope.

## External setup needed before later stages
- Supabase project credentials
- OpenAI API credential
- YouTube OAuth client and target channel authorization
- Render service connection

These do not block local foundation work.

## Next approval gate
Provision the development Supabase connection, migrate it, submit the FDR topic package, and have an authenticated human editor record the first Topic Approval decision. No approval has been fabricated by implementation or test fixtures.
