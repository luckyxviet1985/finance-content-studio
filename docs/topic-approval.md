# Topic Approval checkpoint

Issue #12 supplies the first persisted human approval gate. PostgreSQL is the system of record for the workflow, immutable topic versions, evidence snapshots, scores, decisions, and audit events.

## Trust boundary

Only an authenticated human with the `editor` or `admin` role may view a pending review, submit a draft, approve it, or reject it. Agents and systems may create proposals and revisions but cannot make or inherit an approval. The local operator command accepts an already-authenticated identity from its environment; it is an administrative bridge for trusted development use, not a production authentication mechanism.

An approval pins one exact topic-version ID and its dependency SHA-256. A material revision creates a new immutable version, returns the workflow to `draft`, and leaves the earlier decision in the audit history without applying it to the revision.

## Database setup

Supply a PostgreSQL or Supabase connection string through `DATABASE_URL`, then apply the versioned migration:

```sh
npm install
npm run db:migrate
```

The migration runner serializes concurrent migration attempts, records each file checksum, safely skips exact replays, and rejects changes to a migration that was already applied. Create a new migration for every schema change.

Row-level security is enabled on the Topic Approval tables. No direct client policies are granted in this slice; the application must use a narrowly scoped backend connection. Production Supabase Auth-to-role mapping remains a separate security task.

## Proposal input

The `create` and `revise` commands take a JSON document containing:

- `title`, `thesis`, `audience`, and `format` strings;
- one or more evidence entries with an HTTPS `sourceUrl`, immutable snapshot artifact ID, snapshot SHA-256, capture time, and provenance;
- a versioned score with dimensions, rationale, producer, prompt/model/tool provenance;
- proposal provenance containing a policy version and prompt/model/tool records.

The contract test fixture in `tests/topic-approval.test.mjs` is the canonical local example. Inputs are validated and canonicalized before their artifact and dependency checksums are calculated.

## Trusted local operation

Set these values only from a trusted operator session:

```sh
DATABASE_URL=postgresql://...
MEDIA_OS_OPERATOR_ID=<authenticated-human-id>
MEDIA_OS_OPERATOR_ROLE=editor
MEDIA_OS_OPERATOR_AUTH_SOURCE=<trusted-auth-boundary>
```

Then use the narrow commands below:

```sh
npm run topic:operator -- create --input proposal.json
npm run topic:operator -- submit --workflow <workflow-id> --topic-version <version-id>
npm run topic:operator -- pending --workflow <workflow-id>
npm run topic:operator -- decide --workflow <workflow-id> --topic-version <version-id> --decision approved --rationale "Reviewed evidence and scope." --idempotency-key <stable-request-key> --policy-version topic-approval-policy-v1
```

Use `revise` with the workflow ID and a new proposal file when content or dependencies change. Use a stable idempotency key for a single intended decision request: an exact replay returns the original decision, while reuse with different content fails closed.

## Integrity and recovery

- Never update a topic version, evidence snapshot, score, decision, or audit event in place. Database triggers reject mutation.
- Never force a workflow state. Database transition guards require the matching immutable decision before an approved or rejected state can be committed.
- If the current version or dependency hash differs from the review package, stop and create or inspect the intended revision.
- If migration checksum drift is reported, restore the applied migration file and express the new change in a later migration.
- A failed command is safe to retry only with the same inputs and idempotency key. Investigate an idempotency conflict instead of generating a replacement key.

This checkpoint does not approve archival rights, the script, the rendered video, or publishing.
