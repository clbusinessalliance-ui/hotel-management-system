/**
 * Pure presentation helper: projects invoices into billing rows with payments
 * applied (paid / balance) and the guest resolved via the reservation. Reuses the
 * tested billing core for the money math. Framework-free and unit-testable.
 */

import type { Guest, Invoice, Payment, Reservation } from "@shared/types/index.ts";
import { netBalance, totalPaid } from "@core/billing/index.ts";
import { formatMoney } from "@shared/utils/index.ts";

export interface BillingRow {
  id: string;
  guestName: string;
  totalFormatted: string;
  paidFormatted: string;
  balanceFormatted: string;
  balanceMinor: number;
  currency: string;
  status: Invoice["status"];
}

export function buildBillingRows(
  invoices: Invoice[],
  payments: Payment[],
  reservations: Reservation[],
  guests: Guest[]
): BillingRow[] {
  const reservationById = new Map(reservations.map((r) => [r.id, r]));
  const guestById = new Map(guests.map((g) => [g.id, g]));

  const paymentsByInvoice = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentsByInvoice.get(p.invoiceId) ?? [];
    list.push(p);
    paymentsByInvoice.set(p.invoiceId, list);
  }

  return invoices.map((inv) => {
    const invoicePayments = paymentsByInvoice.get(inv.id) ?? [];
    const reservation = reservationById.get(inv.reservationId);
    const guest = reservation ? guestById.get(reservation.guestId) : undefined;
    const balance = netBalance(inv.total, inv.status, invoicePayments);
    return {
      id: inv.id,
      guestName: guest ? `${guest.firstName} ${guest.lastName}` : "—",
      totalFormatted: formatMoney(inv.total, inv.currency),
      paidFormatted: formatMoney(totalPaid(invoicePayments), inv.currency),
      // Negative balance = refund owed (e.g. a voided invoice with payments).
      balanceFormatted:
        balance < 0
          ? `Refund ${formatMoney(-balance, inv.currency)}`
          : formatMoney(balance, inv.currency),
      balanceMinor: balance,
      currency: inv.currency,
      status: inv.status,
    };
  });
}
