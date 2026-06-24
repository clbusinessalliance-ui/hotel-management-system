/**
 * DoorProvider — the brand-neutral PORT for physical/electronic door access.
 *
 * The PMS core and the Access Engine depend ONLY on this interface. Concrete
 * vendor implementations (TTLock, Salto, Dormakaba, etc.) live exclusively in
 * `src/access/adapters/` and are injected at the composition root.
 *
 * RULE: Never import a concrete adapter from this file or from `src/core/`.
 */

import type { DoorKey, ID, ISODateTimeString, KeyMedium } from "@shared/types/index.ts";

// DoorKey / KeyMedium are shared DTOs (see @shared/types) so the IPC contract can
// reference them without importing the access layer. Re-export for local callers.
export type { DoorKey, KeyMedium } from "@shared/types/index.ts";

/** A door/lock as the PMS understands it — no vendor fields leak in here. */
export interface DoorRef {
  /** PMS-side identifier for the door (maps to a room or common area). */
  id: ID;
  /** Opaque vendor handle resolved by the adapter (serial, lock id, etc.). */
  externalRef?: string;
  label?: string;
}

export interface IssueKeyRequest {
  door: DoorRef;
  /** Who the key is for (guest or staff) — PMS id, not a vendor id. */
  holderId: ID;
  validFrom: ISODateTimeString;
  validUntil: ISODateTimeString;
  /** Credential type to issue. Defaults to "pin" if the provider supports it. */
  medium?: KeyMedium;
}

export interface DoorStatus {
  doorId: ID;
  online: boolean;
  battery?: number; // 0–100, if the hardware reports it
}

/**
 * The capability contract every door vendor adapter must satisfy.
 * Keep this minimal and stable; vendor-specific extras stay inside adapters.
 */
export interface DoorProvider {
  /** Stable provider key, e.g. "noop", "ttlock", "salto". */
  readonly name: string;

  issueKey(request: IssueKeyRequest): Promise<DoorKey>;
  revokeKey(keyId: ID): Promise<void>;
  getStatus(door: DoorRef): Promise<DoorStatus>;
}
