/**
 * SqliteDatabase — concrete `Database` port implementation (desktop).
 *
 * Wraps the synchronous `better-sqlite3` driver behind the async `Database`
 * interface so the rest of the system stays driver-agnostic (a future cloud
 * HTTP client can satisfy the same interface). The driver dependency is confined
 * to this folder — the domain core never imports it.
 */

import BetterSqlite3 from "better-sqlite3";
import type { Database as DatabasePort } from "../db.ts";

export interface SqliteOptions {
  /** File path, or ":memory:" for an ephemeral DB (tests). */
  filename: string;
  /** Log executed SQL (development aid). */
  verbose?: boolean;
}

export class SqliteDatabase implements DatabasePort {
  private readonly db: BetterSqlite3.Database;

  constructor(options: SqliteOptions) {
    this.db = new BetterSqlite3(options.filename, {
      verbose: options.verbose ? (msg?: unknown) => console.debug("[sql]", msg) : undefined,
    });
    // Per-connection settings: enforce FKs, use WAL for desktop concurrency.
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  /** Run one or more statements with no parameters / no result rows. */
  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  /**
   * Run a parameterised statement. Returns rows for read statements; for
   * writes (INSERT/UPDATE/DELETE) it executes and returns an empty array.
   */
  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    if (stmt.reader) {
      return stmt.all(...(params as never[])) as T[];
    }
    stmt.run(...(params as never[]));
    return [];
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
