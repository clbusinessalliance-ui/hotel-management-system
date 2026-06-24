/**
 * Headless startup smoke check — exercises the SAME bootstrap the Electron main
 * process uses, against a real on-disk SQLite file. Proves: connection opens,
 * migrations run, seed loads, repositories read back. Run via `npm run db:smoke`.
 */

import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initDatabase } from "./index.ts";

async function main(): Promise<void> {
  const file = path.join(os.tmpdir(), `hotel-smoke-${Date.now()}.sqlite`);
  console.log(`Connecting SQLite at ${file}`);

  const { db, data, applied, seeded } = await initDatabase({ filename: file, seed: true });
  console.log(`Migrations applied: [${applied.join(", ")}]  seeded: ${seeded}`);

  const props = await data.properties.list();
  const rooms = await data.rooms.list();
  const reservations = await data.reservations.list();
  const admin = await data.users.findByUsername("admin");
  const ownerRole = await data.roles.getById("role_owner");

  console.log(`Property:      ${props[0]?.name} (${props[0]?.type})`);
  console.log(`Rooms:         ${rooms.length}`);
  console.log(`Reservations:  ${reservations.length}`);
  console.log(`Admin user:    ${admin?.displayName} roles=[${admin?.roleIds.join(", ")}]`);
  console.log(`Owner perms:   [${ownerRole?.permissions.join(", ")}]`);

  await db.close();
  for (const suffix of ["", "-wal", "-shm"]) await fs.rm(file + suffix, { force: true });

  const ok = props.length === 1 && rooms.length === 3 && reservations.length === 1 && admin != null;
  console.log(ok ? "\nSQLite smoke OK ✓" : "\nSQLite smoke FAILED ✗");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
