import { describe, it, expect } from "vitest";
import { buildRoomBoardRows } from "./roomBoardRows.ts";
import type { Guest, Reservation, Room, RoomType } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
const TODAY = "2026-06-12";

const roomTypes: RoomType[] = [
  { id: "rt_std", propertyId: "p1", code: "STD", name: "Standard", basePrice: 9000, maxOccupancy: 2, ...stamp },
  { id: "rt_dlx", propertyId: "p1", code: "DLX", name: "Deluxe", basePrice: 12000, maxOccupancy: 3, ...stamp },
];

const guests: Guest[] = [
  { id: "guest_ada", firstName: "Ada", lastName: "Lovelace", ...stamp },
];

const mkRoom = (number: string, extra: Partial<Room> = {}): Room => ({
  id: `room_${number}`, propertyId: "p1", roomTypeId: "rt_std", number, status: "available", ...stamp, ...extra,
});

const mkRes = (extra: Partial<Reservation> = {}): Reservation => ({
  id: "resv_x", propertyId: "p1", guestId: "guest_ada", roomId: "room_101", roomTypeId: "rt_std",
  checkIn: "2026-06-10", checkOut: "2026-06-15", status: "checked_in",
  ratePerNight: 9000, currency: "USD", ...stamp, ...extra,
});

describe("buildRoomBoardRows", () => {
  it("shows the occupant for a checked_in reservation covering today", () => {
    const rows = buildRoomBoardRows([mkRoom("101", { status: "occupied" })], roomTypes, [mkRes()], guests, TODAY);
    const row = rows[0];
    expect(row.currentReservationId).toBe("resv_x");
    expect(row.occupantName).toBe("Ada Lovelace");
    expect(row.todayReservationId).toBe("resv_x");
    expect(row.roomStatus).toBe("occupied");
    expect(row.typeName).toBe("Standard");
  });

  it("flags arrivalToday for a confirmed reservation with checkIn today", () => {
    const res = mkRes({ id: "resv_arr", status: "confirmed", checkIn: TODAY, checkOut: "2026-06-14" });
    const rows = buildRoomBoardRows([mkRoom("101")], roomTypes, [res], guests, TODAY);
    const row = rows[0];
    expect(row.arrivalToday).toBe(true);
    expect(row.departureToday).toBe(false);
    expect(row.currentReservationId).toBeUndefined(); // not checked in yet
    expect(row.occupantName).toBeUndefined();
    expect(row.todayReservationId).toBe("resv_arr");
  });

  it("flags departureToday for a checked_in reservation with checkOut today", () => {
    const res = mkRes({ id: "resv_dep", status: "checked_in", checkIn: "2026-06-09", checkOut: TODAY });
    const rows = buildRoomBoardRows([mkRoom("101", { status: "occupied" })], roomTypes, [res], guests, TODAY);
    const row = rows[0];
    expect(row.departureToday).toBe(true);
    // Still in-house on checkout day, so also the current occupant.
    expect(row.currentReservationId).toBe("resv_dep");
    expect(row.occupantName).toBe("Ada Lovelace");
    expect(row.todayReservationId).toBe("resv_dep");
  });

  it("shows no occupant for available/dirty/out_of_service rooms with no active reservation", () => {
    const rooms = [
      mkRoom("101", { status: "available" }),
      mkRoom("102", { status: "dirty" }),
      mkRoom("103", { status: "out_of_service" }),
    ];
    const rows = buildRoomBoardRows(rooms, roomTypes, [], guests, TODAY);
    for (const row of rows) {
      expect(row.currentReservationId).toBeUndefined();
      expect(row.occupantName).toBeUndefined();
      expect(row.arrivalToday).toBe(false);
      expect(row.departureToday).toBe(false);
      expect(row.todayReservationId).toBeUndefined();
    }
  });

  it("falls back to 'Unknown guest' when the guest record is missing", () => {
    const res = mkRes({ guestId: "ghost" });
    const rows = buildRoomBoardRows([mkRoom("101", { status: "occupied" })], roomTypes, [res], [], TODAY);
    expect(rows[0].occupantName).toBe("Unknown guest");
    expect(rows[0].currentReservationId).toBe("resv_x");
  });

  it("excludes past and future reservations from current occupancy", () => {
    const past = mkRes({ id: "resv_past", status: "checked_out", checkIn: "2026-06-01", checkOut: "2026-06-05" });
    const future = mkRes({ id: "resv_future", status: "confirmed", checkIn: "2026-06-20", checkOut: "2026-06-25" });
    const cancelled = mkRes({ id: "resv_cancel", status: "cancelled", checkIn: "2026-06-10", checkOut: "2026-06-15" });
    const noShow = mkRes({ id: "resv_noshow", status: "no_show", checkIn: "2026-06-10", checkOut: "2026-06-15" });
    const rows = buildRoomBoardRows(
      [mkRoom("101")],
      roomTypes,
      [past, future, cancelled, noShow],
      guests,
      TODAY
    );
    const row = rows[0];
    expect(row.currentReservationId).toBeUndefined();
    expect(row.occupantName).toBeUndefined();
    expect(row.arrivalToday).toBe(false);
    expect(row.departureToday).toBe(false);
    expect(row.todayReservationId).toBeUndefined();
  });

  it("sorts rooms numerically like the rooms helper", () => {
    const rows = buildRoomBoardRows(
      [mkRoom("201"), mkRoom("101"), mkRoom("21")],
      roomTypes,
      [],
      guests,
      TODAY
    );
    expect(rows.map((r) => r.roomNumber)).toEqual(["21", "101", "201"]);
  });

  it("degrades gracefully for missing room type and floor", () => {
    const rows = buildRoomBoardRows([mkRoom("305", { roomTypeId: "ghost" })], roomTypes, [], guests, TODAY);
    expect(rows[0].typeName).toBe("Unknown type");
    expect(rows[0].floor).toBe("—");
  });
});
