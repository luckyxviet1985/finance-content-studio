# Documentary Factory prototype

This directory defines the first documentary-oriented vertical slice for Media OS.

## Prototype

`fdr-bank-holiday/` contains the approved 60–75 second proof of concept, **The Week America Closed Every Bank**.

Each documentary package contains:

- `project.json` — immutable project/render manifest
- `scenes.json` — deterministic scene timeline
- `sources.json` — source, rights, intended-use, and ingestion ledger

## Media ingestion contract

External archive media is untrusted input and must not be fetched directly inside a render composition.

A media-ingestion worker should:

1. Read a source record from `sources.json`.
2. Require a supported rights state before download (`public_domain`, `licensed`, `creative_commons`, or explicitly human-approved exception).
3. Resolve the direct media URL from the catalog page through a source adapter.
4. Download with bounded size/time limits.
5. Calculate SHA-256 and record MIME type, byte size, upstream URL, retrieval time, and adapter version.
6. Store the original immutable asset in S3-compatible/Supabase Storage.
7. Create derived proxy assets separately; never overwrite the original.
8. Attach provenance records to the project artifact version.
9. Block rendering if a required source has no ingested artifact or unresolved rights status.

The system must never infer that a clip is legally safe solely because it is short. Rights metadata and human approval remain distinct from technical ingestion.

## Voice contract

Narration is provider-neutral. The prototype uses `open_montage_test_voice` as a temporary adapter label. A future OpenAI or ElevenLabs adapter can replace it without changing the scene contract.

Primary-source audio (for example the FDR recording) is stored as its own source artifact and is not synthesized.

## Render contract

The renderer consumes only immutable local/storage artifacts plus the approved scene manifest. It must not browse the web during rendering.

Target for this prototype:

- 1280x720 or 1920x1080
- 16:9
- 30 fps
- 72 seconds
- Remotion composition + FFmpeg post-processing
- narration, archival audio, captions, music, and SFX as independent tracks

## Approval integrity

This prototype does not alter existing Media OS approval policy. Topic, script, final-video, and public-publishing approvals remain mandatory. A material change to the script, source set, rights status, or final video invalidates any dependent approval.

## Prototype render sequence

1. Ingest approved archival assets.
2. Generate the temporary narrator track through the voice adapter.
3. Trim the FDR primary-source clip using the timestamps in `project.json` / `sources.json`.
4. Build the Remotion timeline from `scenes.json`.
5. Render picture + dialogue stems.
6. Mix music/SFX and normalize audio in FFmpeg.
7. Generate captions.
8. Run technical QC.
9. Present the immutable final-video artifact for human approval.

No upload or public publishing occurs as part of this prototype.
