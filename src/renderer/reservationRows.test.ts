import { describe, it, expect } from "vitest";
import { buildReservationRows } from "./reservationRows.ts";
import type { Guest, Reservation, Room } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const guests: Guest[] = [
  { id: "g1", firstName: "Ada", lastName: "Lovelace", ...stamp },
];
const rooms: Room[] = [
  { id: "r1", propertyId: "p1", roomTypeId: "rt1", number: "201", status: "occupied", ...stamp },
];

describe("buildReservationRows", () => {
  it("joins guest name, room number, nights and formatted rate", () => {
    const reservations: Reservation[] = [
      {
        id: "res1", propertyId: "p1", guestId: "g1", roomId: "r1", roomTypeId: "rt1",
        checkIn: "2026-06-12", checkOut: "2026-06-15", status: "confirmed",
        ratePerNight: 12000, currency: "USD", ...stamp,
      },
    ];
    const [row] = buildReservationRows(reservations, guests, rooms);
    expect(row.guestName).toBe("Ada Lovelace");
    expect(row.roomNumber).toBe("201");
    expect(row.nights).toBe(3);
    expect(row.status).toBe("confirmed");
    expect(row.rateFormatted).toContain("120");
  });

  it("degrades gracefully for unknown guest / unassigned room", () => {
    const reservations: Reservation[] = [
      {
        id: "res2", propertyId: "p1", guestId: "ghost", roomTypeId: "rt1",
        checkIn: "2026-06-12", checkOut: "2026-06-13", status: "tentative",
        ratePerNight: 9000, currency: "USD", ...stamp,
      },
    ];
    const [row] = buildReservationRows(reservations, guests, rooms);
    expect(row.guestName).toBe("Unknown guest");
    expect(row.roomNumber).toBe("—");
    expect(row.nights).toBe(1);
  });
});
