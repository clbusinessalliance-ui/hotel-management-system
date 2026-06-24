import { describe, it, expect } from "vitest";
import { hasPermission } from "./index.ts";
import type { Role, User } from "@shared/types/index.ts";

const stamp = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

const ownerRole: Role = { id: "role_owner", name: "owner", description: "", permissions: ["*"], ...stamp };
const frontRole: Role = {
  id: "role_front", name: "front_desk", description: "",
  permissions: ["reservation:*", "guest:*", "room:read", "billing:read", "access:issue"],
  ...stamp,
};
const roles = [ownerRole, frontRole];

const user = (roleIds: string[]): User => ({
  id: "u1", username: "u", displayName: "U", roleIds, active: true, ...stamp,
});

describe("hasPermission", () => {
  it("owner wildcard grants everything", () => {
    const owner = user(["role_owner"]);
    expect(hasPermission(owner, roles, "report:read")).toBe(true);
    expect(hasPermission(owner, roles, "user:read")).toBe(true);
    expect(hasPermission(owner, roles, "anything:at:all")).toBe(true);
  });

  it("resource wildcard matches its actions", () => {
    const front = user(["role_front"]);
    expect(hasPermission(front, roles, "reservation:read")).toBe(true); // via reservation:*
    expect(hasPermission(front, roles, "guest:read")).toBe(true); // via guest:*
    expect(hasPermission(front, roles, "room:read")).toBe(true); // exact
    expect(hasPermission(front, roles, "access:issue")).toBe(true);
  });

  it("denies permissions a role does not have", () => {
    const front = user(["role_front"]);
    expect(hasPermission(front, roles, "report:read")).toBe(false);
    expect(hasPermission(front, roles, "property:read")).toBe(false);
    expect(hasPermission(front, roles, "user:read")).toBe(false);
  });
});
