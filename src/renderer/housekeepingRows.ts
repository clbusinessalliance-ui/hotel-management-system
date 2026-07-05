/**
 * Pure presentation helper: joins housekeeping tasks with their room (and,
 * optionally, room type + assignee) so the Housekeeping screen can show
 * readable rows, plus a grouping projection for the operations dashboard.
 * Framework-free and unit-testable. Display projection only — no business logic.
 */

import type { HousekeepingTask, Room, RoomType, User } from "@shared/types/index.ts";

export interface HousekeepingRow {
  id: string;
  roomNumber: string;
  typeName: string;
  scheduledFor: string;
  status: HousekeepingTask["status"];
  assignedTo: string;
  notes: string;
  updatedAt: string;
}

export function buildHousekeepingRows(
  tasks: HousekeepingTask[],
  rooms: Room[],
  roomTypes: RoomType[] = [],
  users: User[] = []
): HousekeepingRow[] {
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const typeById = new Map(roomTypes.map((t) => [t.id, t]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return [...tasks]
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .map((task) => {
      const room = roomById.get(task.roomId);
      const type = room ? typeById.get(room.roomTypeId) : undefined;
      return {
        id: task.id,
        roomNumber: room ? room.number : "—",
        typeName: type ? type.name : "—",
        scheduledFor: task.scheduledFor,
        status: task.status,
        assignedTo: task.assignedTo
          ? userById.get(task.assignedTo)?.displayName ?? task.assignedTo
          : "Unassigned",
        notes: task.notes ?? "",
        updatedAt: task.updatedAt,
      };
    });
}

/** The four operational buckets of the housekeeping dashboard. */
export interface HousekeepingBoard {
  pending: HousekeepingRow[];
  inProgress: HousekeepingRow[];
  /** Cleaned, awaiting inspection. */
  done: HousekeepingRow[];
  /** Inspected tasks completed today (older history is not the dashboard's job). */
  inspectedToday: HousekeepingRow[];
}

/** Calendar-day portion of an ISO date/date-time string. */
function day(value: string): string {
  return value.slice(0, 10);
}

export function groupHousekeepingRows(rows: HousekeepingRow[], today: string): HousekeepingBoard {
  const t = day(today);
  return {
    pending: rows.filter((r) => r.status === "pending"),
    inProgress: rows.filter((r) => r.status === "in_progress"),
    done: rows.filter((r) => r.status === "done"),
    inspectedToday: rows.filter((r) => r.status === "inspected" && day(r.updatedAt) === t),
  };
}
