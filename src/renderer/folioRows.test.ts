import { describe, it, expect } from "vitest";
import { buildFolio, type FolioSources } from "./folioRows.ts";
import type { Guest, Invoice, Payment, Reservation, Room, RoomType } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const guests: Guest[] = [{ id: "guest_ada", firstName: "Ada", lastName: "Lovelace", ...stamp }];

const roomTypes: RoomType[] = [
  { id: "rt_dlx", propertyId: "p1", code: "DLX", name: "Deluxe", basePrice: 12000, maxOccupancy: 3, ...stamp },
];

const rooms: Room[] = [
  { id: "room_201", propertyId: "p1", roomTypeId: "rt_dlx", number: "201", floor: "2", status: "occupied", ...stamp },
];

const reservation: Reservation = {
  id: "resv_1", propertyId: "p1", guestId: "guest_ada", roomId: "room_201", roomTypeId: "rt_dlx",
  checkIn: "2026-06-12", checkOut: "2026-06-15", status: "checked_in",
  ratePerNight: 12000, currency: "USD", ...stamp,
};

const mkInvoice = (id: string, total: number, extra: Partial<Invoice> = {}): Invoice => ({
  id, reservationId: "resv_1", status: "open", currency: "USD", total, ...stamp, ...extra,
});

const mkPayment = (id: string, invoiceId: string, amount: number, createdAt: string, extra: Partial<Payment> = {}): Payment => ({
  id, invoiceId, method: "card", amount, createdAt, updatedAt: createdAt, ...extra,
});

const sources = (overrides: Partial<FolioSources> = {}): FolioSources => ({
  reservations: [reservation],
  invoices: [mkInvoice("inv_1", 36000)],
  payments: [],
  guests,
  rooms,
  roomTypes,
  ...overrides,
});

describe("buildFolio", () => {
  it("joins guest, room, type, dates, nights and rate", () => {
    const folio = buildFolio("resv_1", sources());
    expect(folio).not.toBeNull();
    expect(folio!.guestName).toBe("Ada Lovelace");
    expect(folio!.roomNumber).toBe("201");
    expect(folio!.typeName).toBe("Deluxe");
    expect(folio!.checkIn).toBe("2026-06-12");
    expect(folio!.checkOut).toBe("2026-06-15");
    expect(folio!.nights).toBe(3);
    expect(folio!.ratePerNightFormatted).toContain("120");
    expect(folio!.reservationStatus).toBe("checked_in");
  });

  it("returns null for an unknown reservation", () => {
    expect(buildFolio("resv_ghost", sources())).toBeNull();
  });

  it("shows the owed balance after a partial payment", () => {
    const folio = buildFolio("resv_1", sources({
      payments: [mkPayment("pay_1", "inv_1", 20000, "2026-06-12T10:00:00Z")],
    }));
    expect(folio!.totalInvoicedMinor).toBe(36000);
    expect(folio!.totalPaidMinor).toBe(20000);
    expect(folio!.balanceDueMinor).toBe(16000);
    expect(folio!.refundOwedMinor).toBe(0);
  });

  it("settles to zero when fully paid", () => {
    const folio = buildFolio("resv_1", sources({
      invoices: [mkInvoice("inv_1", 36000, { status: "paid" })],
      payments: [
        mkPayment("pay_1", "inv_1", 20000, "2026-06-12T10:00:00Z"),
        mkPayment("pay_2", "inv_1", 16000, "2026-06-13T09:00:00Z"),
      ],
    }));
    expect(folio!.totalPaidMinor).toBe(36000);
    expect(folio!.balanceDueMinor).toBe(0);
    expect(folio!.refundOwedMinor).toBe(0);
  });

  it("shows refund owed for a void invoice that had payments", () => {
    const folio = buildFolio("resv_1", sources({
      invoices: [mkInvoice("inv_1", 36000, { status: "void" })],
      payments: [mkPayment("pay_1", "inv_1", 20000, "2026-06-12T10:00:00Z")],
    }));
    expect(folio!.totalInvoicedMinor).toBe(0); // void invoices are not billed
    expect(folio!.balanceDueMinor).toBe(0);
    expect(folio!.refundOwedMinor).toBe(20000);
  });

  it("aggregates multiple invoices, keeping owed and refund positions separate", () => {
    const folio = buildFolio("resv_1", sources({
      invoices: [
        mkInvoice("inv_1", 36000), // open, unpaid → 36000 owed
        mkInvoice("inv_2", 5000, { status: "void" }), // void with 5000 paid → refund
      ],
      payments: [mkPayment("pay_1", "inv_2", 5000, "2026-06-12T10:00:00Z")],
    }));
    expect(folio!.totalInvoicedMinor).toBe(36000);
    expect(folio!.invoices).toHaveLength(2);
    expect(folio!.balanceDueMinor).toBe(36000);
    expect(folio!.refundOwedMinor).toBe(5000); // not netted against the owed amount
  });

  it("sorts payment history chronologically and flags refunds, without mutating input", () => {
    const paymentsInput = [
      mkPayment("pay_late", "inv_1", -5000, "2026-06-14T09:00:00Z", { method: "other", reference: "Refund" }),
      mkPayment("pay_early", "inv_1", 20000, "2026-06-12T10:00:00Z"),
    ];
    const inputOrder = paymentsInput.map((p) => p.id);

    const folio = buildFolio("resv_1", sources({ payments: paymentsInput }));
    expect(folio!.payments.map((p) => p.id)).toEqual(["pay_early", "pay_late"]);
    expect(folio!.payments[1].isRefund).toBe(true);
    expect(folio!.payments[1].reference).toBe("Refund");
    expect(folio!.payments[1].amountFormatted).toContain("50"); // absolute amount shown
    // Input array order untouched.
    expect(paymentsInput.map((p) => p.id)).toEqual(inputOrder);
  });

  it("falls back safely for missing guest, room and type", () => {
    const orphan: Reservation = { ...reservation, id: "resv_2", guestId: "ghost", roomId: "room_ghost" };
    const folio = buildFolio("resv_2", sources({
      reservations: [orphan],
      invoices: [],
    }));
    expect(folio!.guestName).toBe("Unknown guest");
    expect(folio!.roomNumber).toBe("—");
    expect(folio!.typeName).toBe("—");
    expect(folio!.invoices).toHaveLength(0);
  });

  it("handles the no-payments case: balance equals the invoiced total", () => {
    const folio = buildFolio("resv_1", sources());
    expect(folio!.payments).toHaveLength(0);
    expect(folio!.totalPaidMinor).toBe(0);
    expect(folio!.balanceDueMinor).toBe(36000);
    expect(folio!.refundOwedMinor).toBe(0);
  });

  it("ignores payments belonging to other reservations' invoices", () => {
    const folio = buildFolio("resv_1", sources({
      payments: [mkPayment("pay_other", "inv_unrelated", 9999, "2026-06-12T10:00:00Z")],
    }));
    expect(folio!.payments).toHaveLength(0);
    expect(folio!.totalPaidMinor).toBe(0);
  });
});
