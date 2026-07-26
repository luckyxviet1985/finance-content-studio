# Risk register

Review cadence: weekly during Milestone 1, then at every milestone exit.

| ID | Risk | Severity | Mitigation | Owner | Status |
|---|---|---:|---|---|---|
| R-001 | Unsupported or stale financial claims | Critical | Source snapshots, claim ledger, freshness rules, independent verification, script gate | Compliance | Open |
| R-002 | Accidental public publishing | Critical | Private-first upload, separate Publisher gate, idempotency and remote reconciliation | Engineering | Open |
| R-003 | Prompt injection through external sources | High | Treat content as data, tool allowlists, instruction isolation, structured validation | Security | Open |
| R-004 | Copyright, licensing, or likeness misuse | High | Source/license metadata, approved asset policies, blocked-source rules, human review | Editorial | Open |
| R-005 | Provider outage or rate limiting | High | Adapters, bounded retries, health checks, approved fallbacks, pause/recovery path | Operations | Open |
| R-006 | Duplicate uploads or external mutations | High | Stable idempotency keys and remote-state reconciliation | Engineering | Open |
| R-007 | Approval applied to changed artifact | Critical | Immutable versions, dependency graph, automatic approval invalidation | Engineering | Open |
| R-008 | Secrets exposed to models or logs | Critical | Secrets manager, redaction, scoped credentials, logging controls, scanning | Security | Open |
| R-009 | Model/provider drift degrades quality | High | Version pinning, golden evaluations, canarying, recorded promotion approval | AI Lead | Open |
| R-010 | Cost runaway | High | Per-task budgets, quotas, cost telemetry, cancellation, provider policies | Operations | Open |
| R-011 | Analytics feedback creates harmful optimization | High | Recommendations only, versioned features, offline evaluation, human promotion | Product | Open |
| R-012 | Inability to reconstruct a published video | Critical | Append-only audit, artifact checksums, prompt/model/policy provenance | Engineering | Open |
| R-013 | Regulatory scope is unclear | Critical | Name compliance owner and jurisdictions before content automation | Product | Open |
| R-014 | Workflow engine lock-in | Medium | Domain-owned state contracts, adapter layer, export/replay strategy | Architecture | Open |
| R-015 | Rendering capacity or nondeterminism | Medium | Immutable manifests, pinned toolchain, QC, isolated worker pool | Media | Open |

## Escalation

Any critical risk without an active mitigation owner blocks the relevant milestone. Any suspected approval bypass or unintended publication is a severity-one incident.