import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {loadProjectBundle} from "../../src/documentary/project-contract.mjs";
import {buildPreviewProps} from "../../src/documentary/preview-contract.mjs";

const manifestPath = process.argv[2];
if (!manifestPath) {
  throw new Error("Usage: node scripts/documentary/build-preview-props.mjs <project.manifest.json>");
}

const bundle = await loadProjectBundle(manifestPath);
const props = buildPreviewProps(bundle);
const repositoryRoot = path.resolve(path.dirname(bundle.paths.manifest), "../../..");
const outputDirectory = path.join(repositoryRoot, "work/preview-props");
const outputPath = path.join(
  outputDirectory,
  `${bundle.manifest.projectId}-v${bundle.manifest.projectVersion}.preview.json`,
);
const serialized = `${JSON.stringify(props, null, 2)}\n`;

await mkdir(outputDirectory, {recursive: true});
try {
  const existing = await readFile(outputPath, "utf8");
  if (existing !== serialized) {
    throw new Error(`Preview props already exist with different bytes: ${outputPath}`);
  }
  process.stdout.write(`Reused identical preview props: ${outputPath}\n`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await writeFile(outputPath, serialized, {flag: "wx"});
  process.stdout.write(`Wrote isolated preview props: ${outputPath}\n`);
}
