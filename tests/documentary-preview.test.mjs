import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  assertRenderReady,
  loadProjectBundle,
} from "../src/documentary/project-contract.mjs";
import {
  assertPreviewProps,
  buildPreviewProps,
} from "../src/documentary/preview-contract.mjs";

const manifestPath = path.resolve(
  import.meta.dirname,
  "../projects/the-week-america-closed-every-bank/v1/project.manifest.json",
);

test("preview props are deterministic, watermarked, and isolated from external media", async () => {
  const bundle = await loadProjectBundle(manifestPath);
  const first = buildPreviewProps(bundle);
  const second = buildPreviewProps(bundle);

  assert.deepEqual(first, second);
  assert.equal(first.mode, "unapproved-animatic-preview");
  assert.equal(first.watermark.text, "PREVIEW — NOT APPROVED FOR RELEASE");
  assert.equal(first.audio.status, "unavailable");
  assert.equal(first.audio.provider, null);
  assert.equal(first.publishing.enabled, false);
  assert.equal(first.timeline.scenes.length, bundle.timeline.scenes.length);

  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, /https?:\/\//);
  assert.doesNotMatch(serialized, /public[\\/]|\.wav|\.mp3|\.ogg|\.jpg|\.png/i);
  assert.doesNotMatch(serialized, /providerBinding|audioSlots|sources/);
  assert.doesNotThrow(() => assertPreviewProps(first));
});

test("preview contract rejects external media, ready audio, and disabled watermarking", async () => {
  const safe = buildPreviewProps(await loadProjectBundle(manifestPath));

  assert.throws(
    () => assertPreviewProps({...safe, externalMedia: ["https://example.test/image.jpg"]}),
    /external media/i,
  );
  assert.throws(
    () =>
      assertPreviewProps({
        ...safe,
        audio: {...safe.audio, status: "ready", path: "voice.wav"},
      }),
    /audio/i,
  );
  assert.throws(
    () => assertPreviewProps({...safe, watermark: {...safe.watermark, required: false}}),
    /watermark/i,
  );
});

test("the production render remains blocked while human approvals are pending", async () => {
  const bundle = await loadProjectBundle(manifestPath);

  assert.throws(() => assertRenderReady(bundle), /human approval/);
});
