/**
 * Database access PORT + migration runner contract.
 *
 * No concrete driver is bound yet (initial scaffold). A SQLite implementation
 * (e.g. better-sqlite3) will satisfy `Database` on the desktop; a remote API
 * client can satisfy the same shape for cloud. Keeping this an interface means
 * the domain never imports a driver directly.
 */

export interface Database {
  /** Run a statement that does not return rows. */
  exec(sql: string): Promise<void>;
  /** Run a parameterised query returning rows. */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

export interface Migration {
  version: string; // e.g. "0001"
  sql: string;
}

/**
 * Applies any migrations not yet recorded in `schema_migrations`.
 * Driver-agnostic: works against any `Database` implementation.
 */
export async function runMigrations(db: Database, migrations: Migration[]): Promise<string[]> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     );`
  );
  const applied = await db.query<{ version: string }>(`SELECT version FROM schema_migrations;`);
  const done = new Set(applied.map((r) => r.version));

  const ran: string[] = [];
  for (const m of [...migrations].sort((a, b) => a.version.localeCompare(b.version))) {
    if (done.has(m.version)) continue;
    await db.exec(m.sql);
    await db.exec(`INSERT INTO schema_migrations (version) VALUES ('${m.version}');`);
    ran.push(m.version);
  }
  return ran;
}
