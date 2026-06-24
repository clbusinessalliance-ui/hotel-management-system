import { describe, it, expect } from "vitest";
import { advanceTask, allowedHousekeepingStatuses } from "./index.ts";
import type { HousekeepingTask } from "@shared/types/index.ts";

const task = (status: HousekeepingTask["status"]): HousekeepingTask => ({
  id: "t1", roomId: "room_1", status, scheduledFor: "2026-06-12",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
});

describe("housekeeping task flow", () => {
  it("lists allowed next statuses", () => {
    expect(allowedHousekeepingStatuses("pending")).toEqual(["in_progress"]);
    expect(allowedHousekeepingStatuses("done")).toEqual(["inspected", "in_progress"]);
    expect(allowedHousekeepingStatuses("inspected")).toEqual([]);
  });

  it("advances valid moves and rejects invalid ones", () => {
    const ok = advanceTask(task("pending"), "in_progress");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.status).toBe("in_progress");

    expect(advanceTask(task("pending"), "done").ok).toBe(false);
  });
});
