/**
 * Pure presentation helper: joins rooms with their room type so the Rooms screen
 * can show readable rows. Framework-free (no React) and unit-testable. Display
 * projection only — no business logic.
 */

import type { Room, RoomType } from "@shared/types/index.ts";
import { formatMoney } from "@shared/utils/index.ts";

export interface RoomRow {
  id: string;
  number: string;
  floor: string;
  typeName: string;
  basePriceFormatted: string;
  status: Room["status"];
}

export function buildRoomRows(rooms: Room[], roomTypes: RoomType[]): RoomRow[] {
  const typeById = new Map(roomTypes.map((t) => [t.id, t]));

  return [...rooms]
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    .map((room) => {
      const type = typeById.get(room.roomTypeId);
      return {
        id: room.id,
        number: room.number,
        floor: room.floor ?? "—",
        typeName: type ? type.name : "Unknown type",
        basePriceFormatted: type ? formatMoney(type.basePrice) : "—",
        status: room.status,
      };
    });
}
