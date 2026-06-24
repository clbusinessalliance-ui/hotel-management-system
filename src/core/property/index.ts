/**
 * Property Management — pure domain logic.
 * A property is a single hotel or guesthouse; the system is multi-property ready.
 */

import type { Property } from "@shared/types/index.ts";

export function validateProperty(p: Pick<Property, "name" | "currency" | "timezone">): string[] {
  const errors: string[] = [];
  if (!p.name.trim()) errors.push("Property name is required");
  if (!/^[A-Z]{3}$/.test(p.currency)) errors.push("Currency must be a 3-letter ISO code");
  if (!p.timezone.trim()) errors.push("Timezone is required");
  return errors;
}
