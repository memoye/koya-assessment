import "server-only";
import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";

// One pool per function instance. On Vercel Fluid compute, attachDatabasePool
// lets idle connections close cleanly before the instance is suspended.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export function getPool(): Pool {
  if (globalForPg.pgPool) return globalForPg.pgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 5_000 });
  pool.on("error", (err) => console.error("pg pool error", err));
  attachDatabasePool(pool);
  globalForPg.pgPool = pool;
  return pool;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}
