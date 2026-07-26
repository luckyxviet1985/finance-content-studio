# Architecture decisions

Status values: Proposed, Accepted, Superseded, Rejected.

## ADR-001 — Modular monolith with isolated workers

Status: Accepted  
Decision: Use a modular monolith for API and domain logic, with separately scalable agent, collection, media, render, and analytics workers.  
Reason: Preserve transactional consistency and policy enforcement while allowing expensive workloads to scale independently.

## ADR-002 — PostgreSQL as system of record

Status: Accepted  
Decision: Store business, workflow, approval, audit, and provenance state in PostgreSQL. Queues and caches are never authoritative.  
Reason: Strong consistency, relational integrity, JSONB escape hatches, and operational maturity.

## ADR-003 — Immutable artifact registry and object storage

Status: Accepted  
Decision: Store artifact metadata and checksums in PostgreSQL and content in S3-compatible object storage. Revisions create new versions.  
Reason: Reproducibility, approval pinning, lifecycle management, and efficient large-object storage.

## ADR-004 — Durable orchestrator owns workflow state

Status: Accepted in principle; product selection pending.  
Decision: A durable workflow engine owns state transitions, retries, timers, fan-out/fan-in, compensation, and human waits. Agents cannot advance state directly.  
Reason: Production runs last hours or days and must survive interruption safely.

## ADR-005 — Provider adapter boundary

Status: Accepted  
Decision: Market data, search/news, models, images, voice, rendering, storage, and YouTube use capability-based adapters.  
Reason: Avoid provider lock-in and standardize health, cost, rate-limit, error, and idempotency behavior.

## ADR-006 — Four mandatory human approval gates

Status: Accepted  
Decision: Require topic, script, final-video, and public-publishing approvals. Approvals pin immutable versions and are invalidated by material dependency changes.  
Reason: Finance-content safety, editorial control, and release accountability.

## ADR-007 — Private-first YouTube publishing

Status: Accepted  
Decision: Upload as private by default. A distinct human Publisher approval is required before scheduling or making public.  
Reason: Prevent accidental publication and separate content approval from release authorization.

## ADR-008 — Agent outputs are untrusted proposals

Status: Accepted  
Decision: Agents have bounded tools and typed outputs. Deterministic services validate schemas, policy, provenance, and authorization before persistence or action.  
Reason: Limit hallucination, prompt injection, privilege escalation, and uncontrolled side effects.

## Open decisions

- Durable workflow engine selection
- Hosting platform and region
- Initial market-data, search, model, image, voice, and render providers
- Applicable compliance jurisdictions
- Retention periods and expected production volume