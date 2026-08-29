import {createHash, randomUUID} from "node:crypto";
import {
  access,
  link,
  mkdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_ASSET_BYTES = 100 * 1024 * 1024;

export const validateAllowlistedUrl = (value, rules) => {
  if (typeof value !== "string") {
    throw new Error("URL is missing from source metadata");
  }
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) {
    throw new Error(`URL is not an allowlisted credential-free HTTPS URL: ${value}`);
  }
  const rule = rules?.find((candidate) => candidate.origin === url.origin);
  if (!rule || !rule.pathPrefixes?.some((prefix) => url.pathname.startsWith(prefix))) {
    throw new Error(`URL is not allowlisted by exact origin and path: ${value}`);
  }
  return url;
};

export const validateMediaTargetPath = (targetPath) => {
  if (typeof targetPath !== "string") {
    throw new Error("Media target path is missing");
  }
  const normalized = targetPath.replaceAll("\\", "/");
  if (
    path.isAbsolute(targetPath) ||
    normalized.includes("../") ||
    !normalized.startsWith("public/media/")
  ) {
    throw new Error(`Unsafe media target path: ${targetPath}`);
  }
  return normalized;
};

const assertRightsApproval = (source) => {
  const {rights} = source;
  if (
    rights?.reviewStatus !== "approved" ||
    !rights.decisionId ||
    !rights.reviewerId ||
    !rights.decidedAt
  ) {
    throw new Error(
      `Source ${source.id} cannot be ingested without a recorded human rights approval`,
    );
  }
};

const assertAssetMatchesSource = (asset, source) => {
  if (asset.sourceId !== source.id) {
    throw new Error("Ingestion asset and source identifiers do not match");
  }
  if (
    asset.expectedMediaType !== source.mediaType ||
    asset.expectedBytes !== source.expectedBytes ||
    asset.expectedSha256 !== source.expectedSha256
  ) {
    throw new Error(`Pinned ingestion metadata does not match source ${source.id}`);
  }
  if (
    !Number.isInteger(asset.expectedBytes) ||
    asset.expectedBytes <= 0 ||
    asset.expectedBytes > MAX_ASSET_BYTES ||
    !SHA256_PATTERN.test(asset.expectedSha256)
  ) {
    throw new Error(`Pinned size or checksum is invalid for source ${source.id}`);
  }
};

const resolveTarget = (destinationRoot, targetPath) => {
  validateMediaTargetPath(targetPath);
  const root = path.resolve(destinationRoot);
  const target = path.resolve(root, targetPath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Media target escapes destination root: ${targetPath}`);
  }
  return target;
};

const readBoundedBody = async (response, expectedBytes, sourceId) => {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== expectedBytes) {
    throw new Error(
      `Byte length mismatch for ${sourceId}: expected ${expectedBytes}, received ${contentLength}`,
    );
  }
  if (!response.body) {
    throw new Error(`Download response has no body for ${sourceId}`);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > expectedBytes) {
      await reader.cancel();
      throw new Error(
        `Byte length mismatch for ${sourceId}: expected ${expectedBytes}, received more than the pinned limit`,
      );
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
};

const assertMissing = async (target) => {
  try {
    await access(target);
    throw new Error(`Refusing to overwrite existing artifact: ${target}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

const commitExclusive = async (temporaryPath, targetPath) => {
  await link(temporaryPath, targetPath);
  await unlink(temporaryPath);
};

export const ingestAsset = async ({
  asset,
  source,
  ingestion,
  destinationRoot,
  ledgerSha256 = null,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
}) => {
  assertRightsApproval(source);
  assertAssetMatchesSource(asset, source);
  validateAllowlistedUrl(source.downloadUrl, ingestion.allowedDownloads);

  const target = resolveTarget(destinationRoot, asset.targetPath);
  const receiptPath = `${target}${ingestion.writePolicy?.receiptSuffix ?? ".provenance.json"}`;
  await assertMissing(target);
  await assertMissing(receiptPath);

  const response = await fetchImpl(source.downloadUrl, {
    redirect: "manual",
    headers: {"user-agent": "finance-content-studio-media-ingestion/1"},
  });
  if (!response.ok) {
    throw new Error(`Download failed for ${source.id}: HTTP ${response.status}`);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Redirects are forbidden for pinned source ${source.id}`);
  }
  const responseMediaType = response.headers.get("content-type")?.split(";", 1)[0];
  if (responseMediaType !== asset.expectedMediaType) {
    throw new Error(
      `Media type mismatch for ${source.id}: expected ${asset.expectedMediaType}, received ${responseMediaType ?? "missing"}`,
    );
  }

  const bytes = await readBoundedBody(response, asset.expectedBytes, source.id);
  if (bytes.byteLength !== asset.expectedBytes) {
    throw new Error(
      `Byte length mismatch for ${source.id}: expected ${asset.expectedBytes}, received ${bytes.byteLength}`,
    );
  }
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== asset.expectedSha256) {
    throw new Error(
      `SHA-256 checksum mismatch for ${source.id}: expected ${asset.expectedSha256}, received ${checksum}`,
    );
  }

  const receipt = {
    schemaVersion: 1,
    ingestedAt: now(),
    ingestionContractVersion: ingestion.contractVersion ?? 1,
    sourceLedgerSha256: ledgerSha256,
    source: {
      id: source.id,
      version: source.sourceVersion ?? source.ledgerVersion ?? 1,
      catalogUrl: source.catalogUrl ?? null,
      downloadUrl: source.downloadUrl,
      originInstitution: source.originInstitution ?? null,
      originIdentifier: source.originIdentifier ?? null,
    },
    rightsApproval: {
      decisionId: source.rights.decisionId,
      reviewerId: source.rights.reviewerId,
      decidedAt: source.rights.decidedAt,
      claim: source.rights.claim ?? null,
    },
    artifact: {
      relativePath: asset.targetPath.replaceAll("\\", "/"),
      mediaType: asset.expectedMediaType,
      bytes: bytes.byteLength,
    },
    checksum: {algorithm: "sha256", sha256: checksum},
    tool: {name: "finance-content-studio-media-ingestion", contractVersion: 1},
  };
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);

  await mkdir(path.dirname(target), {recursive: true});
  const nonce = randomUUID();
  const temporaryTarget = `${target}.${nonce}.tmp`;
  const temporaryReceipt = `${receiptPath}.${nonce}.tmp`;
  await writeFile(temporaryTarget, bytes, {flag: "wx"});
  await writeFile(temporaryReceipt, receiptBytes, {flag: "wx"});

  try {
    await commitExclusive(temporaryTarget, target);
    try {
      await commitExclusive(temporaryReceipt, receiptPath);
    } catch (error) {
      await unlink(target).catch(() => undefined);
      throw error;
    }
  } finally {
    await unlink(temporaryTarget).catch(() => undefined);
    await unlink(temporaryReceipt).catch(() => undefined);
  }

  return {target, receiptPath, sha256: checksum, bytes: bytes.byteLength};
};
