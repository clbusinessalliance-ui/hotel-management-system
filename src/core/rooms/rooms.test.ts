import { describe, it, expect } from "vitest";
import { allowedRoomStatuses, canSetRoomStatus, setRoomStatus, isBookable } from "./index.ts";
import type { Room } from "@shared/types/index.ts";

const room = (status: Room["status"]): Room => ({
  id: "r1", propertyId: "p1", roomTypeId: "rt1", number: "101", status,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
});

describe("room status machine", () => {
  it("allows available -> occupied, blocks available -> dirty", () => {
    expect(canSetRoomStatus("available", "occupied")).toBe(true);
    expect(canSetRoomStatus("available", "dirty")).toBe(false);
  });

  it("lists allowed next statuses", () => {
    expect(allowedRoomStatuses("occupied")).toEqual(["dirty", "out_of_service"]);
    expect(allowedRoomStatuses("available")).toEqual(["occupied", "out_of_service"]);
  });

  it("setRoomStatus applies valid moves and rejects invalid ones", () => {
    const ok = setRoomStatus(room("occupied"), "dirty");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.status).toBe("dirty");

    expect(setRoomStatus(room("available"), "dirty").ok).toBe(false);
  });

  it("isBookable only when available", () => {
    expect(isBookable(room("available"))).toBe(true);
    expect(isBookable(room("occupied"))).toBe(false);
  });
});
