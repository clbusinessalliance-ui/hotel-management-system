/**
 * Pure presentation helper: projects a front-desk "room board" — one row per
 * room, joined with its type and today's relevant reservation (current occupant,
 * arrival, or departure). Framework-free (no React) and unit-testable. Display
 * projection only — no business logic, no persistence, no mutation of inputs.
 *
 * "Today" is passed in (never read from the clock) so the projection stays pure
 * and deterministic. Dates are compared on their calendar-day portion, so both
 * "2026-06-12" and "2026-06-12T14:00:00Z" forms work.
 *
 * Occupancy semantics (cancelled / no_show / checked_out never count):
 *   • current occupant — a `checked_in` reservation whose stay covers today
 *     (checkIn ≤ today ≤ checkOut).
 *   • arrival today    — a `tentative`/`confirmed` reservation due in today
 *     (checkIn == today, not yet checked in).
 *   • departure today  — a `checked_in` reservation due out today
 *     (checkOut == today).
 */

import type {
  Guest,
  ISODateString,
  Reservation,
  Room,
  RoomStatus,
  RoomType,
} from "@shared/types/index.ts";

export interface RoomBoardRow {
  roomId: string;
  roomNumber: string;
  floor: string;
  typeName: string;
  roomStatus: RoomStatus;
  /** Reservation of the guest currently in-house today, if any. */
  currentReservationId?: string;
  /** Display name of the current in-house guest, if any. */
  occupantName?: string;
  arrivalToday: boolean;
  departureToday: boolean;
  /** The reservation relevant to today for this room: current ?? departure ?? arrival. */
  todayReservationId?: string;
}

/** Calendar-day portion of an ISO date/date-time string. */
function day(value: string): string {
  return value.slice(0, 10);
}

export function buildRoomBoardRows(
  rooms: Room[],
  roomTypes: RoomType[],
  reservations: Reservation[],
  guests: Guest[],
  today: ISODateString
): RoomBoardRow[] {
  const typeById = new Map(roomTypes.map((t) => [t.id, t]));
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const t = day(today);

  const guestName = (id: string): string => {
    const g = guestById.get(id);
    return g ? `${g.firstName} ${g.lastName}` : "Unknown guest";
  };

  return [...rooms]
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    .map((room) => {
      const roomReservations = reservations.filter((r) => r.roomId === room.id);

      const current = roomReservations.find(
        (r) => r.status === "checked_in" && day(r.checkIn) <= t && t <= day(r.checkOut)
      );
      const departure = roomReservations.find(
        (r) => r.status === "checked_in" && day(r.checkOut) === t
      );
      const arrival = roomReservations.find(
        (r) => (r.status === "confirmed" || r.status === "tentative") && day(r.checkIn) === t
      );

      return {
        roomId: room.id,
        roomNumber: room.number,
        floor: room.floor ?? "—",
        typeName: typeById.get(room.roomTypeId)?.name ?? "Unknown type",
        roomStatus: room.status,
        currentReservationId: current?.id,
        occupantName: current ? guestName(current.guestId) : undefined,
        arrivalToday: Boolean(arrival),
        departureToday: Boolean(departure),
        todayReservationId: current?.id ?? departure?.id ?? arrival?.id,
      };
    });
}
