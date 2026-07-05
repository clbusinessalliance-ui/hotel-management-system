import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase } from "../../data/sqlite/index.ts";
import { AccessEngine } from "../../access/AccessEngine.ts";
import { NoopDoorProvider } from "../../access/adapters/NoopDoorProvider.ts";
import { PmsCore } from "./index.ts";
import { advanceHousekeepingTask, changeRoomStatus } from "./commands.ts";
import type { Database } from "../../data/db.ts";

/**
 * Automatic room release after inspection: when a housekeeping task passes
 * done → inspected, the room returns to "available" via the existing
 * changeRoomStatus command. Invalid transitions and missing rooms are safe
 * no-ops that never affect the task result.
 */
describe("room release on housekeeping inspection", () => {
  let db: Database;
  let pms: PmsCore;

  beforeEach(async () => {
    const res = await initDatabase({ filename: ":memory:", seed: true });
    db = res.db;
    pms = new PmsCore({ data: res.data, access: new AccessEngine(new NoopDoorProvider()) });
  });

  afterEach(async () => {
    await db.close();
  });

  /** Walk the seeded hk_demo (pending, room_102) through its full flow. */
  async function inspectHkDemo(): Promise<void> {
    await advanceHousekeepingTask(pms, "hk_demo", "in_progress");
    await advanceHousekeepingTask(pms, "hk_demo", "done");
    const inspected = await advanceHousekeepingTask(pms, "hk_demo", "inspected");
    expect(inspected.ok).toBe(true);
  }

  it("inspection returns the room to available", async () => {
    // Seeded room_102 starts 'dirty'.
    expect((await pms.data.rooms.getById("room_102"))?.status).toBe("dirty");

    await inspectHkDemo();

    expect((await pms.data.housekeeping.getById("hk_demo"))?.status).toBe("inspected");
    expect((await pms.data.rooms.getById("room_102"))?.status).toBe("available");
  });

  it("an invalid inspection attempt preserves task and room", async () => {
    // pending → inspected is not allowed (must go through in_progress and done).
    const result = await advanceHousekeepingTask(pms, "hk_demo", "inspected");
    expect(result.ok).toBe(false);

    expect((await pms.data.housekeeping.getById("hk_demo"))?.status).toBe("pending");
    expect((await pms.data.rooms.getById("room_102"))?.status).toBe("dirty");
  });

  it("an already-inspected task makes no further changes", async () => {
    await inspectHkDemo(); // room_102 is now 'available'

    // A new guest takes the room; a stray re-inspection must not release it.
    await changeRoomStatus(pms, "room_102", "occupied");
    const again = await advanceHousekeepingTask(pms, "hk_demo", "inspected");
    expect(again.ok).toBe(false); // inspected is terminal

    expect((await pms.data.rooms.getById("room_102"))?.status).toBe("occupied");
  });

  it("a room that cannot be released is a safe no-op (inspection still succeeds)", async () => {
    // A truly missing room is unrepresentable here: housekeeping_tasks.room_id
    // has a FK to rooms (insert rejected; room deletion cascades the task away).
    // The command's missing-room branch is the same ignored-Result path as an
    // impossible transition, so exercise that reachable equivalent: a task on a
    // room that is 'occupied' — occupied → available is not allowed.
    const stamp = new Date().toISOString();
    await pms.data.housekeeping.save({
      id: "hk_occupied",
      roomId: "room_201", // seeded 'occupied'
      assignedTo: undefined,
      status: "done",
      scheduledFor: stamp.slice(0, 10),
      notes: "Deep clean while occupied",
      createdAt: stamp,
      updatedAt: stamp,
    });

    // Inspection still succeeds for the task; the room release is skipped.
    const result = await advanceHousekeepingTask(pms, "hk_occupied", "inspected");
    expect(result.ok).toBe(true);
    expect((await pms.data.housekeeping.getById("hk_occupied"))?.status).toBe("inspected");
    expect((await pms.data.rooms.getById("room_201"))?.status).toBe("occupied");
  });
});
