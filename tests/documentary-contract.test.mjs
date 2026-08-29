import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadProjectBundle,
  validateProjectBundle,
} from "../src/documentary/project-contract.mjs";
import {
  ingestAsset,
  validateAllowlistedUrl,
  validateMediaTargetPath,
} from "../src/documentary/media-ingestion.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(
  repositoryRoot,
  "projects/the-week-america-closed-every-bank/v1/project.manifest.json",
);

test("the FDR prototype is a valid 70-second immutable bundle", async () => {
  const bundle = await loadProjectBundle(manifestPath);

  assert.deepEqual(validateProjectBundle(bundle), []);
  assert.equal(bundle.timeline.durationFrames, 2100);
  assert.equal(bundle.timeline.durationFrames / bundle.timeline.fps, 70);
  assert.deepEqual(
    Object.keys(bundle.manifest.approvalGates),
    ["topic", "script", "finalVideo", "publicPublishing"],
  );
  assert.equal(bundle.manifest.capabilities.publicPublishing, false);
});

test("a missing mandatory approval gate is rejected", async () => {
  const bundle = structuredClone(await loadProjectBundle(manifestPath));
  delete bundle.manifest.approvalGates.publicPublishing;

  assert.match(validateProjectBundle(bundle).join("\n"), /publicPublishing/);
});

test("source URLs must match an exact allowlisted origin and path", () => {
  const rules = [
    {
      origin: "https://upload.wikimedia.org",
      pathPrefixes: ["/wikipedia/commons/"],
    },
  ];

  assert.doesNotThrow(() =>
    validateAllowlistedUrl(
      "https://upload.wikimedia.org/wikipedia/commons/a/a0/example.ogg",
      rules,
    ),
  );
  assert.throws(
    () =>
      validateAllowlistedUrl(
        "https://upload.wikimedia.org.evil.example/wikipedia/commons/a.ogg",
        rules,
      ),
    /allowlisted/,
  );
  assert.throws(
    () =>
      validateAllowlistedUrl(
        "https://upload.wikimedia.org/wiki/Special:Redirect/example.ogg",
        rules,
      ),
    /allowlisted/,
  );
});

test("ingestion targets cannot escape the generated media root", () => {
  assert.equal(
    validateMediaTargetPath("public/media/documentary/asset.jpg"),
    "public/media/documentary/asset.jpg",
  );
  assert.throws(
    () => validateMediaTargetPath("public/media/documentary/../../secrets.txt"),
    /Unsafe media target path/,
  );
  assert.throws(
    () => validateMediaTargetPath("projects/documentary/asset.jpg"),
    /Unsafe media target path/,
  );
});

test("ingestion fails closed before rights approval", async () => {
  const bundle = await loadProjectBundle(manifestPath);
  const destinationRoot = await mkdtemp(path.join(tmpdir(), "media-os-ingest-"));

  try {
    await assert.rejects(
      () =>
        ingestAsset({
          asset: bundle.ingestion.assets[0],
          source: bundle.sources.sources[0],
          ingestion: bundle.ingestion,
          destinationRoot,
          fetchImpl: async () => {
            throw new Error("fetch must not run before approval");
          },
        }),
      /human rights approval/,
    );
  } finally {
    await rm(destinationRoot, {recursive: true, force: true});
  }
});

test("approved ingestion verifies checksum and writes a provenance receipt", async () => {
  const content = Buffer.from("pinned archival bytes");
  const sha256 = createHash("sha256").update(content).digest("hex");
  const destinationRoot = await mkdtemp(path.join(tmpdir(), "media-os-ingest-"));
  const source = {
    id: "fixture-source",
    ledgerVersion: 1,
    catalogUrl: "https://commons.wikimedia.org/wiki/File:fixture",
    downloadUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/a0/fixture.jpg",
    mediaType: "image/jpeg",
    expectedBytes: content.byteLength,
    expectedSha256: sha256,
    rights: {
      reviewStatus: "approved",
      decisionId: "rights-decision-fixture-v1",
      reviewerId: "human-fixture",
      decidedAt: "2026-08-28T00:00:00Z",
    },
  };
  const asset = {
    sourceId: source.id,
    targetPath: "public/media/fixture.jpg",
    expectedBytes: content.byteLength,
    expectedSha256: sha256,
    expectedMediaType: source.mediaType,
  };
  const ingestion = {
    contractVersion: 1,
    allowedDownloads: [
      {
        origin: "https://upload.wikimedia.org",
        pathPrefixes: ["/wikipedia/commons/"],
      },
    ],
  };

  try {
    const result = await ingestAsset({
      asset,
      source,
      ingestion,
      destinationRoot,
      ledgerSha256: "a".repeat(64),
      fetchImpl: async () =>
        new Response(content, {headers: {"content-type": "image/jpeg"}}),
      now: () => "2026-08-28T01:02:03.000Z",
    });

    assert.equal(result.sha256, sha256);
    assert.deepEqual(
      await readFile(path.join(destinationRoot, asset.targetPath)),
      content,
    );
    const receipt = JSON.parse(
      await readFile(`${path.join(destinationRoot, asset.targetPath)}.provenance.json`, "utf8"),
    );
    assert.equal(receipt.source.id, source.id);
    assert.equal(receipt.rightsApproval.decisionId, source.rights.decisionId);
    assert.equal(receipt.checksum.sha256, sha256);
    assert.equal(receipt.sourceLedgerSha256, "a".repeat(64));
  } finally {
    await rm(destinationRoot, {recursive: true, force: true});
  }
});

test("a checksum mismatch never commits downloaded bytes", async () => {
  const destinationRoot = await mkdtemp(path.join(tmpdir(), "media-os-ingest-"));
  const pinnedSha256 = "0".repeat(64);
  const source = {
    id: "fixture-source",
    downloadUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/a0/fixture.jpg",
    mediaType: "image/jpeg",
    expectedBytes: 5,
    expectedSha256: pinnedSha256,
    rights: {
      reviewStatus: "approved",
      decisionId: "rights-decision-fixture-v1",
      reviewerId: "human-fixture",
      decidedAt: "2026-08-28T00:00:00Z",
    },
  };
  const targetPath = "public/media/fixture.jpg";

  try {
    await assert.rejects(
      () =>
        ingestAsset({
          asset: {
            sourceId: source.id,
            targetPath,
            expectedBytes: 5,
            expectedSha256: pinnedSha256,
            expectedMediaType: source.mediaType,
          },
          source,
          ingestion: {
            allowedDownloads: [
              {
                origin: "https://upload.wikimedia.org",
                pathPrefixes: ["/wikipedia/commons/"],
              },
            ],
          },
          destinationRoot,
          fetchImpl: async () =>
            new Response("wrong", {headers: {"content-type": "image/jpeg"}}),
        }),
      /checksum mismatch/,
    );
    await assert.rejects(
      () => readFile(path.join(destinationRoot, targetPath)),
      /ENOENT/,
    );
  } finally {
    await rm(destinationRoot, {recursive: true, force: true});
  }
});
