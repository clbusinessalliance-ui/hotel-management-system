/** Shared, framework-free utility helpers. */

import type { ISODateString } from "../types/index.ts";

/** Whole nights between two calendar dates (check-out minus check-in). */
export function nightsBetween(checkIn: ISODateString, checkOut: ISODateString): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  if (Number.isNaN(ms)) throw new Error(`Invalid date range: ${checkIn} -> ${checkOut}`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Format minor currency units (e.g. cents) as a human string. */
export function formatMoney(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100);
}

/** Best-effort unique id. Replaceable with a DB sequence / UUID later. */
export function newId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Current timestamp as an ISO-8601 string. */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Case-insensitive substring match for list search. An empty/whitespace query
 * matches everything. `fields` are joined so a query can match across columns.
 */
export function textMatch(fields: Array<string | undefined>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields
    .filter((f): f is string => Boolean(f))
    .some((f) => f.toLowerCase().includes(q));
}
