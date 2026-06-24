import { describe, it, expect } from "vitest";
import { buildRoomRows } from "./roomRows.ts";
import type { Room, RoomType } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const roomTypes: RoomType[] = [
  { id: "rt_std", propertyId: "p1", code: "STD", name: "Standard", basePrice: 9000, maxOccupancy: 2, ...stamp },
  { id: "rt_dlx", propertyId: "p1", code: "DLX", name: "Deluxe", basePrice: 12000, maxOccupancy: 3, ...stamp },
];

const mkRoom = (number: string, roomTypeId: string, extra: Partial<Room> = {}): Room => ({
  id: `room_${number}`, propertyId: "p1", roomTypeId, number, status: "available", ...stamp, ...extra,
});

describe("buildRoomRows", () => {
  it("joins type name + base price and sorts by room number", () => {
    const rows = buildRoomRows(
      [mkRoom("201", "rt_dlx"), mkRoom("101", "rt_std")],
      roomTypes
    );
    expect(rows.map((r) => r.number)).toEqual(["101", "201"]);
    expect(rows[0].typeName).toBe("Standard");
    expect(rows[0].basePriceFormatted).toContain("90");
    expect(rows[1].typeName).toBe("Deluxe");
  });

  it("degrades gracefully for missing type / floor", () => {
    const [row] = buildRoomRows([mkRoom("305", "ghost")], roomTypes);
    expect(row.typeName).toBe("Unknown type");
    expect(row.basePriceFormatted).toBe("—");
    expect(row.floor).toBe("—");
  });
});
