import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {
  assertRenderReady,
  loadProjectBundle,
} from "../../src/documentary/project-contract.mjs";

const manifestPath = process.argv[2];
if (!manifestPath) {
  throw new Error("Usage: node scripts/documentary/build-render-props.mjs <project.manifest.json>");
}

const bundle = await loadProjectBundle(manifestPath);
assertRenderReady(bundle);
const repositoryRoot = path.resolve(path.dirname(bundle.paths.manifest), "../../../..");
const publicPrefix = /^public[\\/]/;
const sources = Object.fromEntries(
  bundle.ingestion.assets.map((asset) => [
    asset.sourceId,
    asset.targetPath.replace(publicPrefix, "").replaceAll("\\", "/"),
  ]),
);
const audioSlots = Object.fromEntries(
  bundle.audioSlots.slots
    .filter((slot) => slot.output.path)
    .map((slot) => [
      slot.id,
      {
        ...slot,
        output: {
          ...slot.output,
          path: slot.output.path.replace(publicPrefix, "").replaceAll("\\", "/"),
        },
      },
    ]),
);
const props = {
  projectId: bundle.manifest.projectId,
  projectVersion: bundle.manifest.projectVersion,
  title: bundle.manifest.title,
  timeline: bundle.timeline,
  render: bundle.render,
  sources,
  audioSlots,
  provenance: {
    artifactChecksums: bundle.checksums,
    approvalRecordIds: Object.fromEntries(
      Object.entries(bundle.manifest.approvalGates).map(([gate, approval]) => [
        gate,
        approval.approvalRecordId,
      ]),
    ),
  },
};
const outputDirectory = path.join(repositoryRoot, "work/render-props");
const outputPath = path.join(
  outputDirectory,
  `${bundle.manifest.projectId}-v${bundle.manifest.projectVersion}.json`,
);
await mkdir(outputDirectory, {recursive: true});
const serialized = `${JSON.stringify(props, null, 2)}\n`;
try {
  const existing = await readFile(outputPath, "utf8");
  if (existing !== serialized) {
    throw new Error(`Render props already exist with different bytes: ${outputPath}`);
  }
  process.stdout.write(`Reused identical immutable render props: ${outputPath}\n`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await writeFile(outputPath, serialized, {flag: "wx"});
  process.stdout.write(`Wrote immutable render props: ${outputPath}\n`);
}
