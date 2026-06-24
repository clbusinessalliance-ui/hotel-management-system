/**
 * Guest Management — pure domain logic.
 */

import type { Guest } from "@shared/types/index.ts";

export function guestFullName(g: Pick<Guest, "firstName" | "lastName">): string {
  return `${g.firstName} ${g.lastName}`.trim();
}

/** Minimal validation used before persisting a guest profile. */
export function validateGuest(g: Pick<Guest, "firstName" | "lastName" | "email">): string[] {
  const errors: string[] = [];
  if (!g.firstName.trim()) errors.push("First name is required");
  if (!g.lastName.trim()) errors.push("Last name is required");
  if (g.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g.email)) errors.push("Email is invalid");
  return errors;
}
