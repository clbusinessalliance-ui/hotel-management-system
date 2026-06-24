/**
 * NoopDoorProvider — a safe, in-memory DoorProvider used for development and tests.
 *
 * It implements the brand-neutral contract WITHOUT talking to any real hardware or
 * vendor service. This is the ONLY door provider that ships today. Real vendor
 * adapters (TTLock, Salto, ...) will be added alongside it later, each in its own
 * subfolder, and selected at the composition root.
 */

import type {
  DoorProvider,
  DoorRef,
  DoorKey,
  DoorStatus,
  IssueKeyRequest,
} from "../DoorProvider.ts";
import type { ID, KeyMedium } from "@shared/types/index.ts";
import { newId } from "@shared/utils/index.ts";

/** Fake 6-digit PIN. */
const pin = () => String(Math.floor(100000 + Math.random() * 900000));
/** Fake 16-hex-char card token. */
const cardToken = () =>
  Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();

export class NoopDoorProvider implements DoorProvider {
  readonly name = "noop";

  private readonly keys = new Map<ID, DoorKey>();

  async issueKey(request: IssueKeyRequest): Promise<DoorKey> {
    const medium: KeyMedium = request.medium ?? "pin";
    const key: DoorKey = {
      id: newId("key"),
      doorId: request.door.id,
      holderId: request.holderId,
      medium,
      // Fake credential for local development: a 6-digit PIN, or a card token.
      secret: medium === "pin" ? pin() : cardToken(),
      validFrom: request.validFrom,
      validUntil: request.validUntil,
      revoked: false,
    };
    this.keys.set(key.id, key);
    return key;
  }

  async revokeKey(keyId: ID): Promise<void> {
    const key = this.keys.get(keyId);
    if (key) key.revoked = true;
  }

  async getStatus(door: DoorRef): Promise<DoorStatus> {
    return { doorId: door.id, online: true, battery: 100 };
  }
}
