/**
 * Pure presentation helper: projects the line items of one invoice for the
 * guest folio (Description / Qty / Amount).
 *
 * Stored `InvoiceItem` rows are used when present — per-line amounts come from
 * the billing core's `lineItemsTotal` applied to that single item, so no money
 * math is duplicated here. Today nothing in the app writes invoice_items yet,
 * so most invoices have no stored items; those are presented as a single
 * synthetic "Room charge" line carrying the invoice's own authoritative total
 * (never recomputed from rate × nights), so the display can never disagree
 * with billing. Framework-free, no mutation of inputs.
 */

import type { InvoiceItem, InvoiceStatus } from "@shared/types/index.ts";
import { lineItemsTotal } from "@core/billing/index.ts";
import { formatMoney } from "@shared/utils/index.ts";

/** The invoice fields this projection needs (subset of the folio invoice line). */
export interface FolioInvoiceRef {
  id: string;
  status: InvoiceStatus;
  totalMinor: number;
  currency: string;
}

export interface FolioItemLine {
  id: string;
  description: string;
  quantity: number;
  amountMinor: number;
  amountFormatted: string;
  /** True when this line was synthesized from the invoice total (no stored items). */
  isSynthetic: boolean;
}

export function buildInvoiceItemLines(
  invoice: FolioInvoiceRef,
  items: InvoiceItem[],
  fallback?: { nights: number }
): FolioItemLine[] {
  const own = items.filter((i) => i.invoiceId === invoice.id);

  if (own.length > 0) {
    return own.map((item) => {
      // Per-line amount = the tested core sum applied to this one item.
      const amount = lineItemsTotal([item]);
      return {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        amountMinor: amount,
        amountFormatted: formatMoney(amount, invoice.currency),
        isSynthetic: false,
      };
    });
  }

  // No stored items: present the invoice as its single room-charge line using
  // the invoice's own total as the amount (qty = nights for context).
  return [
    {
      id: `${invoice.id}_room_charge`,
      description: "Room charge",
      quantity: fallback && fallback.nights > 0 ? fallback.nights : 1,
      amountMinor: invoice.totalMinor,
      amountFormatted: formatMoney(invoice.totalMinor, invoice.currency),
      isSynthetic: true,
    },
  ];
}
