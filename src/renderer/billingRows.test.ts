import { describe, it, expect } from "vitest";
import { buildBillingRows } from "./billingRows.ts";
import type { Guest, Invoice, Payment, Reservation } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const guests: Guest[] = [{ id: "g1", firstName: "Ada", lastName: "Lovelace", ...stamp }];
const reservations: Reservation[] = [
  {
    id: "res1", propertyId: "p1", guestId: "g1", roomTypeId: "rt1",
    checkIn: "2026-06-12", checkOut: "2026-06-15", status: "confirmed",
    ratePerNight: 12000, currency: "USD", ...stamp,
  },
];
const invoices: Invoice[] = [
  { id: "inv1", reservationId: "res1", status: "open", currency: "USD", total: 36000, ...stamp },
];
const payments: Payment[] = [
  { id: "p1", invoiceId: "inv1", method: "card", amount: 20000, ...stamp },
];

describe("buildBillingRows", () => {
  it("resolves guest and computes paid + balance", () => {
    const [row] = buildBillingRows(invoices, payments, reservations, guests);
    expect(row.guestName).toBe("Ada Lovelace");
    expect(row.totalFormatted).toContain("360");
    expect(row.paidFormatted).toContain("200");
    expect(row.balanceFormatted).toContain("160");
    expect(row.balanceMinor).toBe(16000);
    expect(row.currency).toBe("USD");
    expect(row.status).toBe("open");
  });

  it("treats an invoice with no payments as fully outstanding", () => {
    const [row] = buildBillingRows(invoices, [], reservations, guests);
    expect(row.paidFormatted).toContain("0");
    expect(row.balanceFormatted).toContain("360");
  });

  it("shows a refund (negative balance) for a voided invoice with payments", () => {
    const voided: Invoice[] = [{ ...invoices[0], status: "void" }];
    const [row] = buildBillingRows(voided, payments, reservations, guests);
    expect(row.balanceMinor).toBe(-20000);
    expect(row.balanceFormatted).toContain("Refund");
    expect(row.balanceFormatted).toContain("200");
  });
});
