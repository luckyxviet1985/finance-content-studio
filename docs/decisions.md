# Architecture decisions

Status values: Proposed, Accepted, Superseded, Rejected.

## ADR-001 — Modular monolith with isolated workers
Status: Accepted  
Decision: Use a modular monolith for API and domain logic, with separable worker processes for agents, media, rendering, and analytics.

## ADR-002 — Supabase as managed platform foundation
Status: Accepted  
Decision: Use Supabase Postgres as the system of record, Supabase Auth for the initial operator identity, and Supabase Storage for artifacts. Queues and caches are not authoritative.

## ADR-003 — Immutable artifact registry
Status: Accepted  
Decision: Store artifact metadata and checksums in Postgres and content in Supabase Storage. Revisions create new versions. No automatic deletion during development.

## ADR-004 — Lightweight application orchestrator
Status: Accepted  
Decision: Use the OpenAI Responses API for agent execution and a lightweight, durable application orchestrator backed by explicit state and task records in Postgres.  
Migration boundary: Domain workflow definitions, state-transition rules, task contracts, idempotency keys, and approval records must not depend on orchestrator internals so Temporal or another engine can replace it later.

## ADR-005 — Render deployment in US East
Status: Accepted  
Decision: Deploy the application and worker services to Render in US East. Use separately scalable web, general worker, and render worker processes.

## ADR-006 — Provider adapter boundary
Status: Accepted  
Decision:
- LLM: OpenAI
- Images: OpenAI image generation
- Voice: OpenAI audio initially, behind a provider interface compatible with a future ElevenLabs adapter
- Video: Remotion and FFmpeg
- Publishing: YouTube Data API
- Analytics: YouTube Analytics API

## ADR-007 — Four mandatory human approval gates
Status: Accepted  
Decision: Require topic, script, final-video, and public-publishing approvals. Approvals pin immutable versions and are invalidated by material changes.

## ADR-008 — Private-first YouTube publishing
Status: Accepted  
Decision: Upload privately. Public or scheduled release requires a distinct human Publisher decision.

## ADR-009 — Educational US finance content
Status: Accepted  
Decision: Initial audience is the United States and content is educational. The system must avoid personalized financial advice and require source-backed factual claims.

## ADR-010 — Single-channel vertical slice before platform features
Status: Accepted  
Decision: Build one end-to-end path—Topic → Research → Script → Fact Check → Storyboard → Voice → Visuals → Render → Private Upload—before SaaS, billing, multi-user, or multi-channel functionality.

## ADR-011 — Capacity target without redesign
Status: Accepted  
Decision: Initial production is two long-form videos and five Shorts per week. The architecture must scale by adding workers and capacity to one long-form and three Shorts per day without redesign.

## ADR-012 — Agent outputs are untrusted proposals
Status: Accepted  
Decision: Agents have bounded tools and typed outputs. Deterministic services validate schemas, policy, provenance, and authorization before persistence or action.

## Remaining implementation-level decisions
- Exact OpenAI model policy by agent task
- Supabase project and credential provisioning
- YouTube OAuth client and target channel provisioning
- Render service sizing and deployment pipeline
- Production retention schedule after development