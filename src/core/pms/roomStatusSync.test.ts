import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase } from "../../data/sqlite/index.ts";
import { AccessEngine } from "../../access/AccessEngine.ts";
import { NoopDoorProvider } from "../../access/adapters/NoopDoorProvider.ts";
import { PmsCore } from "./index.ts";
import { changeReservationStatus, createGuest, createReservation } from "./commands.ts";
import type { Database } from "../../data/db.ts";

/**
 * Room-status auto-synchronization with the reservation lifecycle.
 * check_in → room occupied; check_out → room dirty; cancelled / no_show leave
 * the room untouched. Reuses the existing changeRoomStatus command, so the room
 * state machine stays authoritative (no duplicate logic).
 */
describe("room status auto-sync on reservation status change", () => {
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
  async function bookRoom101(checkIn = "2026-07-01", checkOut = "2026-07-03"): Promise<string> {
    const guest = await createGuest(pms, { firstName: "Grace", lastName: "Hopper" });
    if (!guest.ok) throw new Error("guest setup failed");
    const res = await createReservation(pms, {
      guestId: guest.value.id,
      roomId: "room_101",
      checkIn,
      checkOut,
    });
    if (!res.ok) throw new Error("reservation setup failed");
    return res.value.id;
  }

  it("check_in → room becomes occupied", async () => {
    // room_101 starts 'available'.
    const id = await bookRoom101();
    const result = await changeReservationStatus(pms, id, "checked_in");
    expect(result.ok).toBe(true);

    expect((await pms.data.reservations.getById(id))?.status).toBe("checked_in");
    expect((await pms.data.rooms.getById("room_101"))?.status).toBe("occupied");
  });

  it("check_out → room becomes dirty", async () => {
    const id = await bookRoom101();
    await changeReservationStatus(pms, id, "checked_in"); // available → occupied
    const result = await changeReservationStatus(pms, id, "checked_out");
    expect(result.ok).toBe(true);

    expect((await pms.data.reservations.getById(id))?.status).toBe("checked_out");
    expect((await pms.data.rooms.getById("room_101"))?.status).toBe("dirty");
  });

  it("cancelled → room is unchanged (must NOT become occupied)", async () => {
    // Seeded resv_demo (confirmed) is on room_201, which is 'occupied'.
    const result = await changeReservationStatus(pms, "resv_demo", "cancelled");
    expect(result.ok).toBe(true);

    // Cancellation touches invoices, never the room status.
    expect((await pms.data.rooms.getById("room_201"))?.status).toBe("occupied");
  });

  it("no_show → room remains available (unchanged)", async () => {
    // Fresh confirmed booking on the available room_101; confirmed → no_show is valid.
    const id = await bookRoom101();
    const result = await changeReservationStatus(pms, id, "no_show");
    expect(result.ok).toBe(true);

    expect((await pms.data.reservations.getById(id))?.status).toBe("no_show");
    expect((await pms.data.rooms.getById("room_101"))?.status).toBe("available");
  });

  it("invalid transition → reservation and room both unchanged", async () => {
    // resv_demo is 'confirmed'; confirmed → checked_out is not allowed.
    const result = await changeReservationStatus(pms, "resv_demo", "checked_out");
    expect(result.ok).toBe(false);

    expect((await pms.data.reservations.getById("resv_demo"))?.status).toBe("confirmed");
    expect((await pms.data.rooms.getById("room_201"))?.status).toBe("occupied");
  });
});
