import pg from "pg";

const {Pool} = pg;

export const createDatabasePool = ({connectionString = process.env.DATABASE_URL} = {}) => {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL operations");
  }
  return new Pool({
    connectionString,
    application_name: "finance-content-studio",
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
};
