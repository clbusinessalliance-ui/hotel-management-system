import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase } from "../../data/sqlite/index.ts";
import { AccessEngine } from "../../access/AccessEngine.ts";
import { NoopDoorProvider } from "../../access/adapters/NoopDoorProvider.ts";
import { PmsCore } from "./index.ts";
import { changeReservationStatus, createGuest, createReservation } from "./commands.ts";
import type { Database } from "../../data/db.ts";
import type { HousekeepingTask } from "@shared/types/index.ts";

/**
 * Automatic housekeeping-task creation on guest checkout.
 * checked_out → one pending, unassigned, dated-today cleaning task for the
 * vacated room — but never a duplicate when an open (pending / in_progress)
 * task already exists. cancelled / no_show create nothing.
 */
describe("housekeeping task auto-creation on checkout", () => {
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

  /** Fresh confirmed reservation on the seeded available room_101. */
  async function bookRoom101(): Promise<string> {
    const guest = await createGuest(pms, { firstName: "Grace", lastName: "Hopper" });
    if (!guest.ok) throw new Error("guest setup failed");
    const res = await createReservation(pms, {
      guestId: guest.value.id,
      roomId: "room_101",
      checkIn: "2026-07-01",
      checkOut: "2026-07-03",
    });
    if (!res.ok) throw new Error("reservation setup failed");
    return res.value.id;
  }

  async function tasksForRoom101(): Promise<HousekeepingTask[]> {
    return (await pms.data.housekeeping.list()).filter((t) => t.roomId === "room_101");
  }

  it("checkout creates one pending, unassigned housekeeping task dated today", async () => {
    const id = await bookRoom101();
    await changeReservationStatus(pms, id, "checked_in");
    expect(await tasksForRoom101()).toHaveLength(0); // nothing yet

    const result = await changeReservationStatus(pms, id, "checked_out");
    expect(result.ok).toBe(true);

    const tasks = await tasksForRoom101();
    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task.status).toBe("pending");
    expect(task.assignedTo).toBeUndefined();
    expect(task.scheduledFor).toBe(new Date().toISOString().slice(0, 10)); // today
    expect(task.notes).toBe("Automatically created after guest checkout");
  });

  it("a second checkout attempt does not create a duplicate task", async () => {
    const id = await bookRoom101();
    await changeReservationStatus(pms, id, "checked_in");
    await changeReservationStatus(pms, id, "checked_out");
    expect(await tasksForRoom101()).toHaveLength(1);

    // checked_out is terminal — the second attempt is rejected and creates nothing.
    const again = await changeReservationStatus(pms, id, "checked_out");
    expect(again.ok).toBe(false);
    expect(await tasksForRoom101()).toHaveLength(1);
  });

  it("an existing open task for the room prevents a duplicate", async () => {
    // Pre-existing pending task for room_101 (e.g. created manually by staff).
    const stamp = new Date().toISOString();
    await pms.data.housekeeping.save({
      id: "hk_existing",
      roomId: "room_101",
      assignedTo: undefined,
      status: "pending",
      scheduledFor: stamp.slice(0, 10),
      notes: "Manual clean",
      createdAt: stamp,
      updatedAt: stamp,
    });

    const id = await bookRoom101();
    await changeReservationStatus(pms, id, "checked_in");
    await changeReservationStatus(pms, id, "checked_out");

    const tasks = await tasksForRoom101();
    expect(tasks).toHaveLength(1); // still only the pre-existing one
    expect(tasks[0].id).toBe("hk_existing");
  });

  it("cancelled reservation creates no housekeeping task", async () => {
    const id = await bookRoom101();
    const result = await changeReservationStatus(pms, id, "cancelled");
    expect(result.ok).toBe(true);
    expect(await tasksForRoom101()).toHaveLength(0);
  });

  it("no_show creates no housekeeping task", async () => {
    const id = await bookRoom101();
    const result = await changeReservationStatus(pms, id, "no_show");
    expect(result.ok).toBe(true);
    expect(await tasksForRoom101()).toHaveLength(0);
  });
});
