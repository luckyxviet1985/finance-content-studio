# FDR documentary prototype: ingestion and render guide

## Scope and current state

Project version 1 is a 70-second, 1920×1080, 30 fps archival documentary scaffold titled **The Week America Closed Every Bank**. Its source of truth is `projects/the-week-america-closed-every-bank/v1/project.manifest.json`; every linked contract is versioned and SHA-256 pinned.

This version is structurally valid but deliberately blocked from ingestion and rendering. It has no approval records, no downloaded media, and no generated narration. It cannot upload or publish.

## Preview-only animatic

Issue #14 adds a separate preview composition for creative pacing review while approvals are pending:

```sh
npm run documentary:preview
```

The preview builder reads the checksummed timeline but emits a deliberately reduced props contract. It contains only procedural scene motifs, draft on-screen narration, timing, approval statuses, and timeline/render checksums. It rejects URLs, file paths, source IDs, provider bindings, ready audio, external-media fields, missing watermarking, or enabled publishing.

The resulting MP4 is always marked `PREVIEW — NOT APPROVED FOR RELEASE`. It uses no archival bytes and makes no provider or publishing call. Remotion may mux a digital-silence AAC stream; verification measures it at or below -90 dB and records that no audible content is present. This silent animatic is not a Topic, Script, rights, or Final Video approval and cannot be promoted into the production render.

OpenMontage narration remains unavailable until a real production checkout is configured. Do not silently substitute another voice provider. After that setup and Script Approval, bind the generated narration through the existing provider-neutral audio slot in a new immutable project version.

## Approval sequence

1. Topic Approval must pin the project/source-ledger version before archival ingestion.
2. Editorial or Compliance must make a human rights decision for each downloadable source. Update by creating a new immutable project/ledger version with the decision ID, reviewer ID, timestamp, and evidence; never treat the recorded source claim as approval.
3. Script Approval must pin the timeline/script version before render props can be built.
4. Narration or audio-provider binding must use the provider-adapter boundary and create a new audio-slots artifact version with prompt/tool/model/voice/artifact/checksum provenance. The current slot is provider-neutral, so an OpenMontage test voice or a future approved provider output can occupy it without changing the scene contract. This repository does not call OpenMontage or ElevenLabs directly.
5. Final Video Approval must pin the verified MP4 checksum before any private upload work.
6. Public Publishing Approval remains a separate mandatory gate. This prototype has no public-publishing capability.

## External media still pending

All three render assets remain external and uncommitted:

| Source ID | Asset | Intended clip/use | Rights claim awaiting human decision |
|---|---|---|---|
| `loc-bank-run-1931` | LOC Bank of United States depositor crowd | Opening and bank-run B-roll | No known restrictions on publication |
| `nara-fdr-fireside-photo-1933-03-12` | NARA March 12, 1933 FDR Fireside Chat photo via Wikimedia Commons | Radio setup and archival-voice scenes | Public-domain US government work |
| `fdr-fireside-audio-1933-03-12` | Edited first Fireside Chat recording via Wikimedia Commons | 12:16–12:28 excerpt; verify the quoted words after ingestion | Public-domain US government work |

The ledger records catalog URLs, origin institutions/identifiers, intended use, rights evidence, exact download URLs, media types, byte counts, and SHA-256 checksums. The ingestion command rejects any remote-byte drift.

## Validate

From the repository root:

```sh
npm install
npm test
npm run typecheck
npm run documentary:validate
```

Validation checks identity/version alignment, artifact checksums, 60–75 second timing, contiguous scenes, source and audio references, all four approval gates, disabled publishing, provider neutrality, allowlisted source metadata, rights-review requirements, and render/timeline consistency.

## Ingest archival media

After a human Topic approval and all three human rights decisions are present in a new immutable version:

```sh
npm run documentary:ingest
```

To ingest one source:

```sh
npm run documentary:ingest -- --source loc-bank-run-1931
```

The ingestor uses HTTPS only, rejects credentials/query strings/fragments/redirects, matches an exact origin and path prefix, verifies content type/byte length/SHA-256, refuses overwrite, and commits the media plus a `.provenance.json` receipt. Media and receipts are generated under `public/media/` and are intentionally ignored by Git.

## Supply narration

The `narration-main` slot expects a timeline-aligned WAV file. Generate it only through an approved provider adapter after Script Approval. Store it at the versioned slot path and create a new audio-slots/project version that marks the output `ready`, records an immutable artifact version, and pins its SHA-256. Do not insert credentials, raw provider responses, or secrets into the project bundle.

The narration master must leave the archival-voice scene silent so the FDR excerpt can play without collision. Optional music/SFX require their own license/provenance records before their slots may become ready.

## Render and verify

Once Topic and Script approvals are pinned and both required audio slots are ready:

```sh
npm run documentary:render
```

The command regenerates props from checked-in contracts, renders through the pinned Remotion/React runtime, and runs `ffprobe` verification. Verification fails unless the file is 1920×1080, 30 fps, approximately 70 seconds, and contains audio. It writes a render receipt with the MP4 SHA-256, media properties, dependency checksums, and approval IDs.

Before requesting Final Video Approval, inspect representative frames and listen to the full mix. In particular, confirm that the 12:16–12:28 source range contains the approved “confidence of the people themselves” excerpt and that captions align with the audible words. Record the installed FFmpeg version in the render task because FFmpeg is operator-pinned in this prototype.

## Revision rule

Never edit an approved artifact version in place. Source changes, checksum drift, timing/script revisions, provider or voice changes, audio replacements, and render-setting changes require new artifact/project versions and invalidate the approvals listed by the project manifest.
