# Finance Content Studio

Human-governed AI finance YouTube production studio.

## FDR Documentary Factory prototype

Issue #8 adds the versioned 70-second project **The Week America Closed Every Bank** under `projects/the-week-america-closed-every-bank/v1/`. It includes a scene timeline, source/rights ledger, provider-neutral audio slots, deterministic ingestion rules, and a Remotion composition scaffold.

The checked-in project is intentionally not render-ready: Topic and Script approvals, human rights decisions, archival ingestion, and a narration artifact are still pending. No publishing capability is included.

```sh
npm install
npm test
npm run typecheck
npm run documentary:validate
```

See `docs/documentary-rendering.md` for approval, ingestion, render, and verification procedures.

To render the silent, procedural, non-publishable animatic without archival media or provider calls:

```sh
npm run documentary:preview
```

Every preview frame is watermarked, and this command does not relax the production render gates.

## Topic Approval foundation

Issue #12 adds the first PostgreSQL-backed approval checkpoint. It stores immutable topic proposals, evidence snapshots, scores, exact-version decisions, and audit events; only a trusted human editor or admin may submit, review, approve, or reject. It includes a migration runner and a narrow local operator command, but no dashboard or production authentication integration.

```sh
npm run db:migrate
npm run topic:operator -- pending --workflow <workflow-id>
```

See `docs/topic-approval.md` for setup, trust-boundary, operation, and recovery guidance.
