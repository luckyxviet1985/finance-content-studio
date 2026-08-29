# Risk register

Review cadence: weekly during the vertical slice and at every approval gate.

| ID | Risk | Severity | Mitigation | Owner | Status |
|---|---|---:|---|---|---|
| R-001 | Unsupported or stale financial claims | Critical | Source snapshots, claim ledger, freshness rules, independent verification, script gate | Compliance | Open |
| R-002 | Accidental public publishing | Critical | Private-first upload, separate Publisher gate, remote reconciliation | Engineering | Open |
| R-003 | Prompt injection through sources | High | Treat sources as data, tool allowlists, instruction isolation, schema validation | Security | Open |
| R-004 | Copyright, licensing, or likeness misuse | High | Versioned rights ledger, exact source allowlists, pinned checksums, blocked ingestion until human review, generated-asset provenance | Editorial | Open |
| R-005 | OpenAI or YouTube outage/rate limit | High | Provider interfaces, bounded retries, pause/recovery, reconciliation | Operations | Open |
| R-006 | Duplicate upload or external mutation | High | Stable idempotency keys and remote-state reconciliation | Engineering | Open |
| R-007 | Approval applied to changed artifact | Critical | Immutable versions, pinned dependency hashes, row-locked decisions, guarded state transitions, automatic invalidation, append-only audit | Engineering | Mitigated for Topic Approval |
| R-008 | Supabase/OpenAI/YouTube secrets exposed | Critical | Secret stores, scoped credentials, redaction, scanning, rotation | Security | Open |
| R-009 | Model drift degrades quality | High | Model/prompt versioning, golden evaluations, recorded promotion | AI Lead | Open |
| R-010 | Cost runaway | High | Task budgets, token/media limits, cost telemetry, cancellation | Operations | Open |
| R-011 | Analytics creates harmful optimization | High | Recommendations only, offline evaluation, human promotion | Product | Open |
| R-012 | Published asset cannot be reconstructed | Critical | Audit trail, checksums, prompt/model/policy provenance | Engineering | Open |
| R-013 | Educational content becomes personalized advice | Critical | US policy rules, prohibited patterns, compliance review, human script gate | Compliance | Open |
| R-014 | Lightweight orchestrator becomes a scaling constraint | Medium | Engine-neutral task/state contracts and migration tests | Architecture | Mitigated |
| R-015 | Render capacity or nondeterminism | Medium | Immutable manifests, pinned Remotion/React, recorded FFmpeg runtime, isolated Render worker, checksum receipts, QC | Media | Open |
| R-016 | Indefinite development retention exposes sensitive data or cost | Medium | Development-only policy, access controls, inventory, production retention decision | Security | Open |

Any critical risk without an active mitigation owner blocks the relevant approval gate.
