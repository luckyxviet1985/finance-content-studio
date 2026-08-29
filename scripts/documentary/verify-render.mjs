import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {promisify} from "node:util";

import {
  assertRenderReady,
  loadProjectBundle,
} from "../../src/documentary/project-contract.mjs";

const run = promisify(execFile);
const [manifestPath, renderPath] = process.argv.slice(2);
if (!manifestPath || !renderPath) {
  throw new Error(
    "Usage: node scripts/documentary/verify-render.mjs <project.manifest.json> <render.mp4>",
  );
}

const bundle = await loadProjectBundle(manifestPath);
assertRenderReady(bundle);
const absoluteRenderPath = path.resolve(renderPath);
const {stdout} = await run("ffprobe", [
  "-v",
  "error",
  "-show_streams",
  "-show_format",
  "-of",
  "json",
  absoluteRenderPath,
]);
const probe = JSON.parse(stdout);
const video = probe.streams.find((stream) => stream.codec_type === "video");
const audio = probe.streams.find((stream) => stream.codec_type === "audio");
const expected = bundle.render.composition;
const actualDuration = Number(probe.format.duration);
const expectedDuration = expected.durationFrames / expected.fps;
const actualFps = video?.r_frame_rate
  ? Number(video.r_frame_rate.split("/")[0]) / Number(video.r_frame_rate.split("/")[1])
  : NaN;
const errors = [];
if (!video || video.width !== expected.width || video.height !== expected.height) {
  errors.push(`expected ${expected.width}x${expected.height} video`);
}
if (Math.abs(actualFps - expected.fps) > 0.001) {
  errors.push(`expected ${expected.fps} fps, received ${actualFps}`);
}
if (Math.abs(actualDuration - expectedDuration) > 0.1) {
  errors.push(`expected ${expectedDuration}s duration, received ${actualDuration}s`);
}
if (!audio) {
  errors.push("expected an audio stream");
}
if (errors.length > 0) {
  throw new Error(`Render verification failed: ${errors.join("; ")}`);
}

const bytes = await readFile(absoluteRenderPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const receipt = {
  schemaVersion: 1,
  projectId: bundle.manifest.projectId,
  projectVersion: bundle.manifest.projectVersion,
  verifiedAt: new Date().toISOString(),
  artifact: {
    path: path.relative(process.cwd(), absoluteRenderPath).replaceAll("\\", "/"),
    bytes: bytes.byteLength,
    sha256,
  },
  media: {
    width: video.width,
    height: video.height,
    fps: actualFps,
    durationSeconds: actualDuration,
    videoCodec: video.codec_name,
    audioCodec: audio.codec_name,
  },
  dependencies: bundle.checksums,
  approvals: Object.fromEntries(
    Object.entries(bundle.manifest.approvalGates).map(([gate, approval]) => [
      gate,
      {status: approval.status, approvalRecordId: approval.approvalRecordId},
    ]),
  ),
  finalVideoApprovalRequired: true,
  publicPublishingEnabled: false,
};
const receiptPath = `${absoluteRenderPath}.render.json`;
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {flag: "wx"});
process.stdout.write(`Verified render ${absoluteRenderPath}\nSHA-256: ${sha256}\nReceipt: ${receiptPath}\n`);
