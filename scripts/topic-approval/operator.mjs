import {readFile} from "node:fs/promises";

import {createDatabasePool} from "../../src/database/pool.mjs";
import {PostgresTopicApprovalRepository} from "../../src/topic-approval/postgres-repository.mjs";
import {TopicApprovalService} from "../../src/topic-approval/service.mjs";

const usage = `Usage:
  npm run topic:operator -- create --input <proposal.json>
  npm run topic:operator -- revise --workflow <id> --input <proposal.json>
  npm run topic:operator -- submit --workflow <id> --topic-version <id>
  npm run topic:operator -- pending --workflow <id>
  npm run topic:operator -- decide --workflow <id> --topic-version <id> --decision <approved|rejected> --rationale <text> --idempotency-key <key> --policy-version <version>

Required environment:
  DATABASE_URL
  MEDIA_OS_OPERATOR_ID
  MEDIA_OS_OPERATOR_ROLE=editor|admin
  MEDIA_OS_OPERATOR_AUTH_SOURCE
`;

const main = async () => {
  const [command, ...rawArgs] = process.argv.slice(2);
  const flags = new Map();
  for (let index = 0; index < rawArgs.length; index += 2) {
    const name = rawArgs[index];
    const value = rawArgs[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(usage);
    flags.set(name.slice(2), value);
  }

  const requiredFlag = (name) => {
    const value = flags.get(name);
    if (!value) throw new Error(`Missing --${name}\n\n${usage}`);
    return value;
  };
  const actor = {
    type: "human",
    id: process.env.MEDIA_OS_OPERATOR_ID,
    role: process.env.MEDIA_OS_OPERATOR_ROLE,
    authenticated: true,
    authSource: process.env.MEDIA_OS_OPERATOR_AUTH_SOURCE,
  };
  if (!actor.id || !actor.role || !actor.authSource) {
    throw new Error(`Trusted operator environment is incomplete.\n\n${usage}`);
  }
  const readProposal = async () =>
    JSON.parse(await readFile(requiredFlag("input"), "utf8"));
  const pool = createDatabasePool();
  const service = new TopicApprovalService({
    repository: new PostgresTopicApprovalRepository({pool}),
  });

  try {
    let result;
    switch (command) {
      case "create":
        result = await service.createDraft({proposal: await readProposal(), actor});
        break;
      case "revise":
        result = await service.createRevision({
          workflowId: requiredFlag("workflow"),
          proposal: await readProposal(),
          actor,
        });
        break;
      case "submit":
        result = await service.submitForApproval({
          workflowId: requiredFlag("workflow"),
          topicVersionId: requiredFlag("topic-version"),
          actor,
        });
        break;
      case "pending":
        result = await service.getPendingReview({
          workflowId: requiredFlag("workflow"),
          actor,
        });
        break;
      case "decide":
        result = await service.decide({
          workflowId: requiredFlag("workflow"),
          topicVersionId: requiredFlag("topic-version"),
          decision: requiredFlag("decision"),
          rationale: requiredFlag("rationale"),
          idempotencyKey: requiredFlag("idempotency-key"),
          policyVersion: requiredFlag("policy-version"),
          actor,
        });
        break;
      default:
        throw new Error(usage);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  const output = {
    status: "error",
    code: error.code ?? "OPERATOR_COMMAND_FAILED",
    message: error.message,
  };
  process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
});
