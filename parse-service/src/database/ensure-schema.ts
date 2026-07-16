import { Client } from 'pg';

// Postgres won't create a table in a schema that doesn't exist yet, and
// TypeORM's `synchronize` doesn't create the schema itself — so this runs
// once before the pool connects, ahead of `synchronize`.
export async function ensureSchemaExists(
  databaseUrl: string,
  schema: string,
): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await client.end();
  }
}
