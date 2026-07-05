import { describe, it, expect } from "vitest";
import { buildInvoiceItemLines, type FolioInvoiceRef } from "./folioItemRows.ts";
import type { InvoiceItem } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const invoice: FolioInvoiceRef = { id: "inv_1", status: "open", totalMinor: 9500, currency: "USD" };

const mkItem = (id: string, description: string, quantity: number, unitPrice: number, extra: Partial<InvoiceItem> = {}): InvoiceItem => ({
  id, invoiceId: "inv_1", description, quantity, unitPrice, ...stamp, ...extra,
});

describe("buildInvoiceItemLines", () => {
  it("projects stored items with per-line amounts from the billing core", () => {
    const lines = buildInvoiceItemLines(invoice, [
      mkItem("it_room", "Room Charge", 2, 4000),
      mkItem("it_bfast", "Breakfast", 2, 500),
      mkItem("it_laundry", "Laundry", 1, 500),
    ]);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({
      description: "Room Charge",
      quantity: 2,
      amountMinor: 8000, // 2 × 4000, via lineItemsTotal
      isSynthetic: false,
    });
    expect(lines[0].amountFormatted).toContain("80");
    expect(lines[1].amountMinor).toBe(1000);
    expect(lines[2].amountMinor).toBe(500);
  });

  it("only projects items belonging to the given invoice", () => {
    const lines = buildInvoiceItemLines(invoice, [
      mkItem("it_mine", "Mini Bar", 1, 1200),
      mkItem("it_other", "Airport Pickup", 1, 3000, { invoiceId: "inv_other" }),
    ]);
    expect(lines.map((l) => l.id)).toEqual(["it_mine"]);
  });

  it("synthesizes a single room-charge line from the invoice total when no items exist", () => {
    const lines = buildInvoiceItemLines(invoice, [], { nights: 3 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      description: "Room charge",
      quantity: 3,
      amountMinor: 9500, // the invoice's own total — never rate × nights
      isSynthetic: true,
    });
  });

  it("synthetic fallback defaults quantity to 1 without nights context", () => {
    expect(buildInvoiceItemLines(invoice, [])[0].quantity).toBe(1);
    expect(buildInvoiceItemLines(invoice, [], { nights: 0 })[0].quantity).toBe(1);
  });

  it("does not mutate the items input", () => {
    const items = [
      mkItem("b", "Laundry", 1, 500),
      mkItem("a", "Breakfast", 2, 500),
    ];
    const order = items.map((i) => i.id);
    buildInvoiceItemLines(invoice, items);
    expect(items.map((i) => i.id)).toEqual(order);
  });
});
