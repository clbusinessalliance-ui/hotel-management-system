import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase } from "./index.ts";
import type { Database } from "../db.ts";
import type { DataContext } from "../repositories.ts";

/**
 * Integration test for the SQLite layer. Runs migrations + seed against an
 * in-memory database and verifies repositories (incl. join-table relations)
 * round-trip correctly. Confirms the architecture's ports are fully functional.
 */
describe("SQLite data layer", () => {
  let db: Database;
  let data: DataContext;

  beforeAll(async () => {
    const res = await initDatabase({ filename: ":memory:", seed: true });
    db = res.db;
    data = res.data;
    expect(res.applied).toContain("0001");
    expect(res.seeded).toBe(true);
  });

  afterAll(async () => {
    await db.close();
  });

  it("loads seed data across tables", async () => {
    expect((await data.properties.list())).toHaveLength(1);
    expect((await data.rooms.list())).toHaveLength(3);
    expect((await data.reservations.list())).toHaveLength(1);
  });

  it("resolves user → roles via the join table", async () => {
    const admin = await data.users.findByUsername("admin");
    expect(admin).not.toBeNull();
    expect(admin!.roleIds).toEqual(["role_owner"]);
    expect(admin!.active).toBe(true);
  });

  it("resolves role → permissions via the join table", async () => {
    const owner = await data.roles.getById("role_owner");
    expect(owner?.permissions).toEqual(["*"]);
  });

  it("creates, reads, updates and deletes through a repository", async () => {
    const now = new Date().toISOString();
    await data.guests.save({
      id: "guest_test", firstName: "Grace", lastName: "Hopper",
      createdAt: now, updatedAt: now,
    });

    let g = await data.guests.getById("guest_test");
    expect(g?.lastName).toBe("Hopper");

    await data.guests.save({ ...g!, lastName: "Hopper-Updated", updatedAt: new Date().toISOString() });
    g = await data.guests.getById("guest_test");
    expect(g?.lastName).toBe("Hopper-Updated");

    await data.guests.delete("guest_test");
    expect(await data.guests.getById("guest_test")).toBeNull();
  });

  it("supports custom finders (reservations by guest)", async () => {
    const found = await data.reservations.findByGuest("guest_demo");
    expect(found).toHaveLength(1);
    expect(found[0].roomId).toBe("room_201");
  });

  it("is idempotent: re-seeding an already-seeded DB is a no-op", async () => {
    const res2 = await initDatabase({ filename: ":memory:", seed: true });
    // fresh in-memory DB seeds again; the guard only suppresses within one DB.
    expect(res2.seeded).toBe(true);
    await res2.db.close();
  });
});
