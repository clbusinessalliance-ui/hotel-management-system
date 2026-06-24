/**
 * Room Management — pure domain logic.
 */

import type { Result, Room, RoomStatus } from "@shared/types/index.ts";

const NEXT_STATUS: Record<RoomStatus, RoomStatus[]> = {
  available: ["occupied", "out_of_service"],
  occupied: ["dirty", "out_of_service"],
  dirty: ["available", "out_of_service"],
  out_of_service: ["available"],
};

export function canSetRoomStatus(from: RoomStatus, to: RoomStatus): boolean {
  return NEXT_STATUS[from].includes(to);
}

/** The statuses a room in `from` may move to next (drives UI actions). */
export function allowedRoomStatuses(from: RoomStatus): RoomStatus[] {
  return NEXT_STATUS[from];
}

/** Apply a room status change, guarded by the transition map. Pure. */
export function setRoomStatus(room: Room, to: RoomStatus): Result<Room> {
  if (!canSetRoomStatus(room.status, to)) {
    return { ok: false, error: `Cannot move room from ${room.status} to ${to}` };
  }
  return { ok: true, value: { ...room, status: to } };
}

export function isBookable(room: Room): boolean {
  return room.status === "available";
}
