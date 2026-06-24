/**
 * Billing / Payments — pure domain logic.
 */

import type { InvoiceItem, InvoiceStatus, Money, Payment } from "@shared/types/index.ts";

/** Sum of line items (minor currency units). */
export function lineItemsTotal(items: Pick<InvoiceItem, "quantity" | "unitPrice">[]): Money {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

/** Total paid against an invoice. */
export function totalPaid(payments: Pick<Payment, "amount">[]): Money {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

/** Remaining balance (never negative). */
export function balanceDue(total: Money, payments: Pick<Payment, "amount">[]): Money {
  return Math.max(0, total - totalPaid(payments));
}

export function isSettled(total: Money, payments: Pick<Payment, "amount">[]): boolean {
  return balanceDue(total, payments) === 0;
}

/**
 * Signed net balance for an invoice, accounting for its status:
 *   > 0  guest still owes
 *   = 0  settled
 *   < 0  refund owed (e.g. a voided invoice that had payments taken)
 * A void invoice carries no charge, so anything already paid becomes a refund.
 */
export function netBalance(
  total: Money,
  status: InvoiceStatus,
  payments: Pick<Payment, "amount">[]
): Money {
  const effectiveTotal = status === "void" ? 0 : total;
  return effectiveTotal - totalPaid(payments);
}
