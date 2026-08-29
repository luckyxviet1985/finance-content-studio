# Backlog

## Current critical path

1. Repository and CI foundation
2. Supabase schema and local development contract — Topic Approval slice ready for review
3. Lightweight durable workflow state machine — Topic Approval states implemented
4. Artifact, source, claim, provenance, and approval primitives — topic scope implemented
5. Topic candidate ingestion and evidence capture — deterministic topic contract implemented
6. Versioned topic scoring — persisted immutable score implemented
7. Topic approval API and operator view — domain service and narrow local CLI implemented; production auth/UI deferred
8. Research agent and dossier
9. Script agent and claim extraction
10. Fact check and educational-content compliance
11. Script approval
12. Storyboard, voice, visuals, captions, and thumbnail
13. Remotion/FFmpeg render and QC
14. Final-video approval
15. Idempotent private YouTube upload
16. Public publishing approval
17. Analytics feedback

## Milestone 1 P0
- Complete issue #3 repository and CI standards.
- Complete issue #4 threat model and data classification.
- Complete issue #5 environment, secrets, retention, and access strategy.
- Merge issue #12, provision the development Supabase connection, and record the first real Topic Approval through a trusted human operator.

## Milestone 3 prototype track
- Issue #8 merged: FDR archival documentary project contracts and Remotion scaffold.
- Review and merge issue #14: isolated, silent, procedural animatic preview with permanent non-release watermark.
- Record a real Topic approval before invoking the prototype ingestion command.
- Obtain human rights decisions for the LOC bank-run photograph, NARA/Wikimedia FDR photograph, and FDR archival recording.
- Ingest the three pinned archival assets and preserve generated provenance receipts.
- Approve the versioned script/timeline before binding a narration artifact or rendering.
- Generate test narration through an approved provider adapter; do not add a production ElevenLabs integration in this track.
- Render and verify the 70-second MP4, then request Final Video approval.

## Explicitly deferred
- SaaS and billing
- Multi-user collaboration
- Multiple channels
- ElevenLabs implementation
- Autonomous public publishing
- Scale-specific infrastructure not needed for the approved capacity target
