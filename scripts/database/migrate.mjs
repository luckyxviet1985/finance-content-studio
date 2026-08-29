import path from "node:path";

import {applyMigrations} from "../../src/database/migrations.mjs";
import {createDatabasePool} from "../../src/database/pool.mjs";

const pool = createDatabasePool();
try {
  const result = await applyMigrations({
    pool,
    migrationsDirectory: path.resolve("supabase/migrations"),
  });
  process.stdout.write(
    `${JSON.stringify({status: "ok", ...result}, null, 2)}\n`,
  );
} finally {
  await pool.end();
}
