/**
 * Pure presentation helper: joins reservations with their guest and room so the
 * Reservations screen can render readable rows. Framework-free (no React) so it
 * is unit-testable in isolation. No business logic — display projection only.
 */

import type { Guest, Reservation, Room } from "@shared/types/index.ts";
import { formatMoney, nightsBetween } from "@shared/utils/index.ts";

export interface ReservationRow {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: Reservation["status"];
  rateFormatted: string;
}

export function buildReservationRows(
  reservations: Reservation[],
  guests: Guest[],
  rooms: Room[]
): ReservationRow[] {
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  return reservations.map((res) => {
    const guest = guestById.get(res.guestId);
    const room = res.roomId ? roomById.get(res.roomId) : undefined;
    return {
      id: res.id,
      guestName: guest ? `${guest.firstName} ${guest.lastName}` : "Unknown guest",
      roomNumber: room ? room.number : "—",
      checkIn: res.checkIn,
      checkOut: res.checkOut,
      nights: nightsBetween(res.checkIn, res.checkOut),
      status: res.status,
      rateFormatted: formatMoney(res.ratePerNight, res.currency),
    };
  });
}
