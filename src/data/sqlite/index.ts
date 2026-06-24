/**
 * SQLite bootstrap — the entry point the composition root uses to obtain a live,
 * migrated (and optionally seeded) DataContext.
 *
 * Connection lifecycle: `initDatabase` opens the connection and runs migrations;
 * the caller owns the returned `db` handle and must `close()` it on shutdown.
 */

import { SqliteDatabase, type SqliteOptions } from "./SqliteDatabase.ts";
import { createDataContext } from "./repositories.ts";
import { ensureAdminPassword, isSeeded, seedDev } from "./seed.ts";
import { runMigrations, type Database } from "../db.ts";
import { migrations } from "../migrations/index.ts";
import type { DataContext } from "../repositories.ts";

export interface InitOptions extends SqliteOptions {
  /** Load development seed data if the database is empty. Default: false. */
  seed?: boolean;
}

export interface InitResult {
  db: Database;
  data: DataContext;
  /** Migration versions applied during this init (empty if already up to date). */
  applied: string[];
  seeded: boolean;
}

export async function initDatabase(options: InitOptions): Promise<InitResult> {
  const db = new SqliteDatabase(options);
  const applied = await runMigrations(db, migrations);
  const data = createDataContext(db);

  let seeded = false;
  if (options.seed && !(await isSeeded(data))) {
    await seedDev(data);
    seeded = true;
  }

  // Always ensure the dev admin can sign in (covers already-seeded databases).
  if (options.seed) await ensureAdminPassword(data);

  return { db, data, applied, seeded };
}

export { SqliteDatabase } from "./SqliteDatabase.ts";
export { createDataContext } from "./repositories.ts";
export { isSeeded, seedDev } from "./seed.ts";
export type { SqliteOptions } from "./SqliteDatabase.ts";
