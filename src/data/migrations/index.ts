import type { Migration } from "../db.ts";
import { migration0001 } from "./0001_init.ts";
import { migration0002 } from "./0002_access_key_secret.ts";

/**
 * Ordered migration registry. Add new migrations here; the runner applies any
 * not yet recorded in `schema_migrations`, in ascending version order.
 */
export const migrations: Migration[] = [migration0001, migration0002];
