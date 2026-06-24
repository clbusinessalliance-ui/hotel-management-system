import { describe, it, expect } from "vitest";
import {
  occupancyRate,
  averageStayNights,
  revenueSummary,
  countByStatus,
  arrivalsOn,
  departuresOn,
} from "./index.ts";
import type { Invoice, Payment, Reservation, Room } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const room = (id: string, status: Room["status"]): Room => ({
  id, propertyId: "p1", roomTypeId: "rt1", number: id, status, ...stamp,
});

const reservation = (
  id: string,
  status: Reservation["status"],
  checkIn: string,
  checkOut: string
): Reservation => ({
  id, propertyId: "p1", guestId: "g1", roomId: "r1", roomTypeId: "rt1",
  checkIn, checkOut, status, ratePerNight: 9000, currency: "USD", ...stamp,
});

describe("reports", () => {
  it("computes occupancy rate", () => {
    expect(occupancyRate([room("1", "occupied"), room("2", "available")])).toBe(0.5);
    expect(occupancyRate([])).toBe(0);
  });

  it("computes average stay nights", () => {
    const res = [
      reservation("a", "confirmed", "2026-06-10", "2026-06-12"), // 2
      reservation("b", "confirmed", "2026-06-10", "2026-06-14"), // 4
    ];
    expect(averageStayNights(res)).toBe(3);
  });

  it("summarises revenue with outstanding and refunds owed", () => {
    const invoices: Invoice[] = [
      { id: "i1", reservationId: "a", status: "open", currency: "USD", total: 36000, ...stamp },
      { id: "i2", reservationId: "b", status: "void", currency: "USD", total: 20000, ...stamp },
    ];
    const payments: Payment[] = [
      { id: "p1", invoiceId: "i1", method: "card", amount: 20000, ...stamp }, // open: 16000 outstanding
      { id: "p2", invoiceId: "i2", method: "card", amount: 5000, ...stamp }, // void: 5000 refund owed
    ];
    const r = revenueSummary(invoices, payments);
    expect(r.invoiced).toBe(36000); // void excluded
    expect(r.collected).toBe(25000); // net payments
    expect(r.outstanding).toBe(16000);
    expect(r.refundsOwed).toBe(5000);
  });

  it("counts reservations by status with all keys present", () => {
    const counts = countByStatus([
      reservation("a", "confirmed", "2026-06-10", "2026-06-12"),
      reservation("b", "confirmed", "2026-06-10", "2026-06-12"),
      reservation("c", "cancelled", "2026-06-10", "2026-06-12"),
    ]);
    expect(counts.confirmed).toBe(2);
    expect(counts.cancelled).toBe(1);
    expect(counts.no_show).toBe(0);
  });

  it("finds arrivals and departures on a date (active only)", () => {
    const res = [
      reservation("a", "confirmed", "2026-06-12", "2026-06-15"),
      reservation("b", "checked_in", "2026-06-10", "2026-06-12"),
      reservation("c", "cancelled", "2026-06-12", "2026-06-14"), // excluded
    ];
    expect(arrivalsOn(res, "2026-06-12").map((r) => r.id)).toEqual(["a"]);
    expect(departuresOn(res, "2026-06-12").map((r) => r.id)).toEqual(["b"]);
  });
});
