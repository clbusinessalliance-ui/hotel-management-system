import { describe, it, expect } from "vitest";
import {
  quoteReservation,
  canTransition,
  allowedTransitions,
  datesOverlap,
  findRoomConflict,
} from "./index.ts";
import { lineItemsTotal, balanceDue, isSettled, netBalance } from "../billing/index.ts";
import type { Reservation } from "@shared/types/index.ts";

describe("reservation pricing", () => {
  it("computes nights and subtotal", () => {
    const q = quoteReservation("2026-06-12", "2026-06-15", 9000); // 90.00 / night
    expect(q.nights).toBe(3);
    expect(q.subtotal).toBe(27000);
  });

  it("rejects a zero-night stay", () => {
    expect(() => quoteReservation("2026-06-12", "2026-06-12", 9000)).toThrow();
  });
});

describe("reservation status machine", () => {
  it("allows confirmed -> checked_in", () => {
    expect(canTransition("confirmed", "checked_in")).toBe(true);
  });
  it("blocks checked_out -> checked_in", () => {
    expect(canTransition("checked_out", "checked_in")).toBe(false);
  });

  it("lists allowed transitions per status", () => {
    expect(allowedTransitions("confirmed")).toEqual(["checked_in", "cancelled", "no_show"]);
    expect(allowedTransitions("checked_out")).toEqual([]);
  });
});

describe("room availability", () => {
  const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
  const existing: Reservation[] = [
    {
      id: "res1", propertyId: "p1", guestId: "g1", roomId: "room_1", roomTypeId: "rt1",
      checkIn: "2026-06-12", checkOut: "2026-06-15", status: "confirmed",
      ratePerNight: 9000, currency: "USD", ...stamp,
    },
  ];

  it("detects half-open date overlap", () => {
    expect(datesOverlap("2026-06-13", "2026-06-14", "2026-06-12", "2026-06-15")).toBe(true);
    // Back-to-back (checkout == next check-in) does NOT overlap.
    expect(datesOverlap("2026-06-15", "2026-06-17", "2026-06-12", "2026-06-15")).toBe(false);
  });

  it("flags a conflicting booking on the same room", () => {
    expect(findRoomConflict("room_1", "2026-06-14", "2026-06-16", existing)?.id).toBe("res1");
  });

  it("allows a non-overlapping booking and a different room", () => {
    expect(findRoomConflict("room_1", "2026-06-15", "2026-06-18", existing)).toBeNull();
    expect(findRoomConflict("room_2", "2026-06-12", "2026-06-15", existing)).toBeNull();
  });

  it("ignores cancelled reservations", () => {
    const cancelled: Reservation[] = [{ ...existing[0], status: "cancelled" }];
    expect(findRoomConflict("room_1", "2026-06-13", "2026-06-14", cancelled)).toBeNull();
  });
});

describe("billing", () => {
  const items = [
    { quantity: 3, unitPrice: 9000 }, // room nights
    { quantity: 1, unitPrice: 1500 }, // minibar
  ];

  it("totals line items", () => {
    expect(lineItemsTotal(items)).toBe(28500);
  });

  it("tracks balance and settlement", () => {
    const total = lineItemsTotal(items);
    expect(balanceDue(total, [{ amount: 20000 }])).toBe(8500);
    expect(isSettled(total, [{ amount: 28500 }])).toBe(true);
  });

  it("netBalance signs by status: owed, settled, and refund on void", () => {
    expect(netBalance(36000, "open", [{ amount: 20000 }])).toBe(16000); // guest owes
    expect(netBalance(36000, "paid", [{ amount: 36000 }])).toBe(0); // settled
    expect(netBalance(36000, "void", [{ amount: 20000 }])).toBe(-20000); // refund owed
  });
});
