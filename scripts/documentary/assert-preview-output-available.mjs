import {access} from "node:fs/promises";
import {resolve} from "node:path";

const outputArgument = process.argv[2];

if (!outputArgument) {
  throw new Error("Usage: node scripts/documentary/assert-preview-output-available.mjs <output-path>");
}

const outputPath = resolve(outputArgument);
const receiptPath = `${outputPath}.preview.json`;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

const existingPaths = [];

for (const path of [outputPath, receiptPath]) {
  if (await exists(path)) {
    existingPaths.push(path);
  }
}

if (existingPaths.length > 0) {
  throw new Error(
    `Preview output already exists. Preserve it, or deliberately remove both the video and receipt before rerendering:\n${existingPaths.join("\n")}`,
  );
}

console.log(`Preview output slot is available: ${outputPath}`);
