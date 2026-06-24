/**
 * Reservation Management — pure domain logic.
 * No UI, no database, no lock vendor. Persistence arrives via ReservationRepository.
 */

import type { Money, Reservation, ReservationStatus, Result } from "@shared/types/index.ts";
import { nightsBetween } from "@shared/utils/index.ts";

export interface ReservationQuote {
  nights: number;
  ratePerNight: Money;
  subtotal: Money;
}

/** Compute the price of a stay. Throws on invalid date ranges. */
export function quoteReservation(
  checkIn: string,
  checkOut: string,
  ratePerNight: Money
): ReservationQuote {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) throw new Error("Stay must be at least one night");
  return { nights, ratePerNight, subtotal: nights * ratePerNight };
}

/** Allowed reservation status transitions (state machine). */
const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  tentative: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The statuses a reservation in `from` may move to next (drives UI actions). */
export function allowedTransitions(from: ReservationStatus): ReservationStatus[] {
  return TRANSITIONS[from];
}

export function changeStatus(
  reservation: Reservation,
  to: ReservationStatus
): Result<Reservation> {
  if (!canTransition(reservation.status, to)) {
    return { ok: false, error: `Cannot move reservation from ${reservation.status} to ${to}` };
  }
  return { ok: true, value: { ...reservation, status: to } };
}

/** Statuses that occupy a room (cancelled / no_show free it up). */
const OCCUPYING: ReservationStatus[] = ["tentative", "confirmed", "checked_in", "checked_out"];

/** Half-open date-range overlap: [aIn, aOut) intersects [bIn, bOut). */
export function datesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return Date.parse(aIn) < Date.parse(bOut) && Date.parse(bIn) < Date.parse(aOut);
}

/**
 * Find an existing reservation that blocks booking `roomId` for [checkIn, checkOut).
 * Returns the conflicting reservation, or null if the room is free. `ignoreId`
 * lets callers exclude a reservation being edited.
 */
export function findRoomConflict(
  roomId: string,
  checkIn: string,
  checkOut: string,
  reservations: Reservation[],
  ignoreId?: string
): Reservation | null {
  return (
    reservations.find(
      (r) =>
        r.roomId === roomId &&
        r.id !== ignoreId &&
        OCCUPYING.includes(r.status) &&
        datesOverlap(checkIn, checkOut, r.checkIn, r.checkOut)
    ) ?? null
  );
}
