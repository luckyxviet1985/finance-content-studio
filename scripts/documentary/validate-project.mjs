import path from "node:path";

import {
  loadProjectBundle,
  validateProjectBundle,
} from "../../src/documentary/project-contract.mjs";

const manifestPath = process.argv[2];
if (!manifestPath) {
  throw new Error("Usage: node scripts/documentary/validate-project.mjs <project.manifest.json>");
}

const bundle = await loadProjectBundle(manifestPath);
const errors = validateProjectBundle(bundle);
if (errors.length > 0) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Valid documentary bundle: ${bundle.manifest.projectId} v${bundle.manifest.projectVersion} (${bundle.timeline.durationSeconds}s, ${bundle.timeline.scenes.length} scenes)\nManifest: ${path.resolve(manifestPath)}\n`,
  );
}
