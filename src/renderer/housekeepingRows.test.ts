import { describe, it, expect } from "vitest";
import { buildHousekeepingRows } from "./housekeepingRows.ts";
import type { HousekeepingTask, Room } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const rooms: Room[] = [
  { id: "room_102", propertyId: "p1", roomTypeId: "rt1", number: "102", status: "dirty", ...stamp },
];

const mkTask = (id: string, scheduledFor: string, extra: Partial<HousekeepingTask> = {}): HousekeepingTask => ({
  id, roomId: "room_102", status: "pending", scheduledFor, ...stamp, ...extra,
});

describe("buildHousekeepingRows", () => {
  it("joins room number and sorts by scheduled date", () => {
    const rows = buildHousekeepingRows(
      [mkTask("t2", "2026-06-14"), mkTask("t1", "2026-06-12")],
      rooms
    );
    expect(rows.map((r) => r.id)).toEqual(["t1", "t2"]);
    expect(rows[0].roomNumber).toBe("102");
  });

  it("falls back gracefully for missing room / assignee / notes", () => {
    const [row] = buildHousekeepingRows(
      [mkTask("t3", "2026-06-12", { roomId: "ghost" })],
      rooms
    );
    expect(row.roomNumber).toBe("—");
    expect(row.assignedTo).toBe("Unassigned");
    expect(row.notes).toBe("");
  });
});
