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
