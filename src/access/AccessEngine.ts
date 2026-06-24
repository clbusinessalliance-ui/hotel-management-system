/**
 * AccessEngine — brand-neutral orchestrator for door access.
 *
 * It coordinates PMS intent ("give this guest a key for room 204 for their stay")
 * and delegates the physical work to whatever `DoorProvider` was injected. It has
 * NO knowledge of any specific lock vendor.
 */

import type {
  DoorProvider,
  DoorRef,
  DoorKey,
  DoorStatus,
} from "./DoorProvider.ts";
import type { ID, ISODateTimeString, KeyMedium, Result } from "@shared/types/index.ts";

export interface IssueStayKeyInput {
  door: DoorRef;
  holderId: ID;
  validFrom: ISODateTimeString;
  validUntil: ISODateTimeString;
  medium?: KeyMedium;
}

export class AccessEngine {
  constructor(private readonly provider: DoorProvider) {}

  /** Which vendor is currently wired in (for diagnostics / UI). */
  get providerName(): string {
    return this.provider.name;
  }

  /** Issue a door key for the duration of a stay. */
  async issueStayKey(input: IssueStayKeyInput): Promise<Result<DoorKey>> {
    if (Date.parse(input.validUntil) <= Date.parse(input.validFrom)) {
      return { ok: false, error: "validUntil must be after validFrom" };
    }
    try {
      const key = await this.provider.issueKey(input);
      return { ok: true, value: key };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async revokeKey(keyId: ID): Promise<Result<true>> {
    try {
      await this.provider.revokeKey(keyId);
      return { ok: true, value: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async getDoorStatus(door: DoorRef): Promise<Result<DoorStatus>> {
    try {
      return { ok: true, value: await this.provider.getStatus(door) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
