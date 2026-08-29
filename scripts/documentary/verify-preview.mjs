import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {promisify} from "node:util";

import {loadProjectBundle} from "../../src/documentary/project-contract.mjs";
import {buildPreviewProps} from "../../src/documentary/preview-contract.mjs";

const run = promisify(execFile);
const [manifestPath, renderPath] = process.argv.slice(2);
if (!manifestPath || !renderPath) {
  throw new Error(
    "Usage: node scripts/documentary/verify-preview.mjs <project.manifest.json> <preview.mp4>",
  );
}

const bundle = await loadProjectBundle(manifestPath);
const preview = buildPreviewProps(bundle);
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
const expected = preview.composition;
const actualDuration = Number(probe.format.duration);
const actualFps = video?.r_frame_rate
  ? Number(video.r_frame_rate.split("/")[0]) / Number(video.r_frame_rate.split("/")[1])
  : NaN;
const errors = [];
let maxVolumeDb = null;
if (!video || video.width !== expected.width || video.height !== expected.height) {
  errors.push(`expected ${expected.width}x${expected.height} video`);
}
if (Math.abs(actualFps - expected.fps) > 0.001) {
  errors.push(`expected ${expected.fps} fps, received ${actualFps}`);
}
if (Math.abs(actualDuration - expected.durationFrames / expected.fps) > 0.1) {
  errors.push(
    `expected ${expected.durationFrames / expected.fps}s duration, received ${actualDuration}s`,
  );
}
if (audio) {
  const {stderr} = await run("ffmpeg", [
    "-nostdin",
    "-hide_banner",
    "-i",
    absoluteRenderPath,
    "-map",
    "0:a:0",
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ]);
  const match = stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/i);
  maxVolumeDb = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(maxVolumeDb) || maxVolumeDb > -90) {
    errors.push(`preview audio stream is not digital silence: ${maxVolumeDb} dB`);
  }
}
if (errors.length > 0) {
  throw new Error(`Preview verification failed: ${errors.join("; ")}`);
}

const bytes = await readFile(absoluteRenderPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const receipt = {
  schemaVersion: 1,
  artifactType: "unapproved-animatic-preview",
  projectId: preview.projectId,
  projectVersion: preview.projectVersion,
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
    audioStreamPresent: Boolean(audio),
    audibleContentPresent: false,
    maxVolumeDb,
  },
  isolation: {
    proceduralVisualsOnly: true,
    externalMediaPresent: false,
    audioProvider: null,
    watermark: preview.watermark.text,
  },
  approvals: preview.provenance.approvalStatuses,
  publishable: false,
  finalVideoApprovalConferred: false,
};
const receiptPath = `${absoluteRenderPath}.preview.json`;
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {flag: "wx"});
process.stdout.write(
  `Verified isolated preview ${absoluteRenderPath}\nSHA-256: ${sha256}\nReceipt: ${receiptPath}\n`,
);
