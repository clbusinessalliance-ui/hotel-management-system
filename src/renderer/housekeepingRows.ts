/**
 * Pure presentation helper: joins housekeeping tasks with their room so the
 * Housekeeping screen can show readable rows. Framework-free and unit-testable.
 * Display projection only — no business logic.
 */

import type { HousekeepingTask, Room } from "@shared/types/index.ts";

export interface HousekeepingRow {
  id: string;
  roomNumber: string;
  scheduledFor: string;
  status: HousekeepingTask["status"];
  assignedTo: string;
  notes: string;
}

export function buildHousekeepingRows(
  tasks: HousekeepingTask[],
  rooms: Room[]
): HousekeepingRow[] {
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  return [...tasks]
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .map((task) => {
      const room = roomById.get(task.roomId);
      return {
        id: task.id,
        roomNumber: room ? room.number : "—",
        scheduledFor: task.scheduledFor,
        status: task.status,
        assignedTo: task.assignedTo ?? "Unassigned",
        notes: task.notes ?? "",
      };
    });
}
