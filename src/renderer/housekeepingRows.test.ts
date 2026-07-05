import { describe, it, expect } from "vitest";
import { buildHousekeepingRows, groupHousekeepingRows } from "./housekeepingRows.ts";
import type { HousekeepingTask, Room, RoomType, User } from "@shared/types/index.ts";

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
    expect(row.typeName).toBe("—");
    expect(row.assignedTo).toBe("Unassigned");
    expect(row.notes).toBe("");
  });

  it("joins room type name and resolves assignee to a display name", () => {
    const roomTypes: RoomType[] = [
      { id: "rt1", propertyId: "p1", code: "STD", name: "Standard", basePrice: 9000, maxOccupancy: 2, ...stamp },
    ];
    const users: User[] = [
      { id: "user_hk", username: "maria", displayName: "Maria Santos", roleIds: [], active: true, ...stamp },
    ];
    const [row] = buildHousekeepingRows(
      [mkTask("t4", "2026-06-12", { assignedTo: "user_hk" })],
      rooms,
      roomTypes,
      users
    );
    expect(row.typeName).toBe("Standard");
    expect(row.assignedTo).toBe("Maria Santos");

    // Unknown assignee id degrades to the raw id rather than hiding the fact.
    const [ghost] = buildHousekeepingRows(
      [mkTask("t5", "2026-06-12", { assignedTo: "user_ghost" })],
      rooms,
      roomTypes,
      users
    );
    expect(ghost.assignedTo).toBe("user_ghost");
  });
});

describe("groupHousekeepingRows", () => {
  const TODAY = "2026-06-12";

  it("groups rows into the four dashboard buckets", () => {
    const rows = buildHousekeepingRows(
      [
        mkTask("t_pending", TODAY, { status: "pending" }),
        mkTask("t_progress", TODAY, { status: "in_progress" }),
        mkTask("t_done", TODAY, { status: "done" }),
        mkTask("t_inspected", TODAY, {
          status: "inspected",
          updatedAt: "2026-06-12T10:00:00Z",
        }),
      ],
      rooms
    );
    const board = groupHousekeepingRows(rows, TODAY);
    expect(board.pending.map((r) => r.id)).toEqual(["t_pending"]);
    expect(board.inProgress.map((r) => r.id)).toEqual(["t_progress"]);
    expect(board.done.map((r) => r.id)).toEqual(["t_done"]);
    expect(board.inspectedToday.map((r) => r.id)).toEqual(["t_inspected"]);
  });

  it("excludes inspected tasks completed on earlier days", () => {
    const rows = buildHousekeepingRows(
      [
        mkTask("t_old", "2026-06-10", { status: "inspected", updatedAt: "2026-06-10T09:00:00Z" }),
        mkTask("t_new", TODAY, { status: "inspected", updatedAt: "2026-06-12T09:00:00Z" }),
      ],
      rooms
    );
    const board = groupHousekeepingRows(rows, TODAY);
    expect(board.inspectedToday.map((r) => r.id)).toEqual(["t_new"]);
    // Older inspected history belongs to reports, not the operations dashboard.
    expect(board.pending).toHaveLength(0);
    expect(board.inProgress).toHaveLength(0);
    expect(board.done).toHaveLength(0);
  });
});
