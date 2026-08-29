import {createHash} from "node:crypto";
import {readdir, readFile} from "node:fs/promises";
import path from "node:path";

const MIGRATION_PATTERN = /^(\d{14})_[a-z0-9_]+\.sql$/;

export const applyMigrations = async ({pool, migrationsDirectory}) => {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('media_os_schema_migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.media_os_schema_migrations (
        version text PRIMARY KEY,
        filename text NOT NULL,
        sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const filenames = (await readdir(migrationsDirectory))
      .filter((name) => MIGRATION_PATTERN.test(name))
      .sort();
    const applied = [];
    const skipped = [];

    for (const filename of filenames) {
      const version = filename.match(MIGRATION_PATTERN)[1];
      const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        `SELECT filename, sha256
           FROM public.media_os_schema_migrations
          WHERE version = $1`,
        [version],
      );
      if (existing.rows[0]) {
        if (
          existing.rows[0].filename !== filename ||
          existing.rows[0].sha256.trim() !== checksum
        ) {
          throw new Error(
            `Applied migration ${version} differs from ${filename}; create a new migration instead`,
          );
        }
        skipped.push(filename);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO public.media_os_schema_migrations (version, filename, sha256)
           VALUES ($1, $2, $3)`,
          [version, filename, checksum],
        );
        await client.query("COMMIT");
        applied.push(filename);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return {applied, skipped};
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('media_os_schema_migrations'))")
      .catch(() => undefined);
    client.release();
  }
};
