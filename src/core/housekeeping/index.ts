/**
 * Housekeeping — pure domain logic.
 */

import type { HousekeepingStatus, HousekeepingTask, Result } from "@shared/types/index.ts";

const FLOW: Record<HousekeepingStatus, HousekeepingStatus[]> = {
  pending: ["in_progress"],
  in_progress: ["done"],
  done: ["inspected", "in_progress"],
  inspected: [],
};

/** The statuses a task in `from` may move to next (drives UI actions). */
export function allowedHousekeepingStatuses(from: HousekeepingStatus): HousekeepingStatus[] {
  return FLOW[from];
}

export function advanceTask(
  task: HousekeepingTask,
  to: HousekeepingStatus
): Result<HousekeepingTask> {
  if (!FLOW[task.status].includes(to)) {
    return { ok: false, error: `Cannot move task from ${task.status} to ${to}` };
  }
  return { ok: true, value: { ...task, status: to } };
}
