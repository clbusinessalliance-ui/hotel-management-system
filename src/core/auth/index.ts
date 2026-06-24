/**
 * Authentication / Users / Roles — pure domain logic.
 *
 * Password hashing, session issuance, and persistence are injected later
 * (composition root). This module owns the permission model only.
 */

import type { Role, RoleName, User } from "@shared/types/index.ts";

/** Permission strings follow "<resource>:<action>" (e.g. "reservation:create"). */
export type Permission = string;

/** Default role → permission map. Tune as the product grows. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  owner: ["*"],
  manager: [
    "reservation:*",
    "guest:*",
    "room:*",
    "billing:*",
    "housekeeping:*",
    "report:read",
  ],
  front_desk: ["reservation:*", "guest:*", "room:read", "billing:read", "access:issue"],
  housekeeping: ["housekeeping:*", "room:read"],
  accountant: ["billing:*", "report:read"],
};

/** True if any of the user's roles grant the permission (supports "*" wildcards). */
export function hasPermission(user: User, roles: Role[], required: Permission): boolean {
  const granted = roles
    .filter((r) => user.roleIds.includes(r.id))
    .flatMap((r) => r.permissions);

  return granted.some((p) => permissionMatches(p, required));
}

function permissionMatches(granted: Permission, required: Permission): boolean {
  if (granted === "*") return true;
  if (granted === required) return true;
  // Resource-level wildcard, e.g. "reservation:*" matches "reservation:create".
  const [gRes, gAct] = granted.split(":");
  const [rRes] = required.split(":");
  return gAct === "*" && gRes === rRes;
}
