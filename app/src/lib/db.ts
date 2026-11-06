import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __prPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__prPool) {
    global.__prPool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgres://pr:pr@localhost:5432/politierechter",
      max: Number(process.env.PG_POOL_MAX ?? 10),
    });
  }
  return global.__prPool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await q<T>(text, params);
  return rows[0];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
