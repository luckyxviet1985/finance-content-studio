import path from "node:path";

import {ingestAsset} from "../../src/documentary/media-ingestion.mjs";
import {
  assertIngestionReady,
  loadProjectBundle,
} from "../../src/documentary/project-contract.mjs";

const manifestPath = process.argv[2];
const sourceFlag = process.argv.indexOf("--source");
const selectedSourceId = sourceFlag === -1 ? null : process.argv[sourceFlag + 1];
if (!manifestPath || (sourceFlag !== -1 && !selectedSourceId)) {
  throw new Error(
    "Usage: node scripts/documentary/ingest-media.mjs <project.manifest.json> [--source <source-id>]",
  );
}

const bundle = await loadProjectBundle(manifestPath);
assertIngestionReady(bundle);
const repositoryRoot = path.resolve(path.dirname(bundle.paths.manifest), "../../../..");
const assets = selectedSourceId
  ? bundle.ingestion.assets.filter((asset) => asset.sourceId === selectedSourceId)
  : bundle.ingestion.assets;
if (assets.length === 0) {
  throw new Error(`No ingestion asset found for source ${selectedSourceId}`);
}

for (const asset of assets) {
  const source = bundle.sources.sources.find((candidate) => candidate.id === asset.sourceId);
  const result = await ingestAsset({
    asset,
    source,
    ingestion: bundle.ingestion,
    destinationRoot: repositoryRoot,
    ledgerSha256: bundle.checksums.sourceLedger,
  });
  process.stdout.write(`Ingested ${asset.sourceId}: ${result.target} (${result.sha256})\n`);
}
