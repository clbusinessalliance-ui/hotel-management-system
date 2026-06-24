import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase } from "../../data/sqlite/index.ts";
import { AccessEngine } from "../../access/AccessEngine.ts";
import { NoopDoorProvider } from "../../access/adapters/NoopDoorProvider.ts";
import { PmsCore } from "./index.ts";
import { getInfo, getSummary, listRooms, listReservations } from "./queries.ts";
import type { Database } from "../../data/db.ts";

/** Read-only query use-cases over a seeded in-memory database. */
describe("PMS read queries", () => {
  let db: Database;
  let pms: PmsCore;

  beforeAll(async () => {
    const res = await initDatabase({ filename: ":memory:", seed: true });
    db = res.db;
    pms = new PmsCore({ data: res.data, access: new AccessEngine(new NoopDoorProvider()) });
  });

  afterAll(async () => {
    await db.close();
  });

  it("getInfo reports version and the wired door provider", async () => {
    const info = await getInfo(pms);
    expect(info.version).toBe("0.1.0");
    expect(info.doorProvider).toBe("noop");
  });

  it("getSummary returns the seeded property and counts", async () => {
    const summary = await getSummary(pms);
    expect(summary.property?.name).toBe("Seaside Guesthouse");
    expect(summary.counts.rooms).toBe(3);
    expect(summary.counts.reservations).toBe(1);
    expect(summary.counts.users).toBe(1);
  });

  it("list reads pass through repository data", async () => {
    expect(await listRooms(pms)).toHaveLength(3);
    const reservations = await listReservations(pms);
    expect(reservations).toHaveLength(1);
    expect(reservations[0].guestId).toBe("guest_demo");
  });
});
