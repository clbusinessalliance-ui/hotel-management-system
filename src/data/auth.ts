/**
 * Password hashing (Node infra — uses node:crypto, lives in the data layer, never
 * imported by the renderer or the pure core).
 *
 * Production scheme: scrypt with a unique per-user random salt, stored in a
 * versioned, self-describing format:
 *
 *     scrypt:v1:<N>:<r>:<p>:<saltBase64>:<hashBase64>
 *
 * Backward compatibility: pre-production hashes were raw SHA-256 over a static
 * salt (64 hex chars). `verifyPassword` still accepts those and reports
 * `needsUpgrade` so the caller can rehash to scrypt after a successful login.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt cost parameters. N must be a power of two; 16384 (2^14) is a sensible
// interactive cost. Memory ≈ 128*N*r ≈ 16 MB, within maxmem.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 } as const;

// Legacy (pre-production) static salt — kept for VERIFICATION ONLY so existing
// users can log in and be upgraded. Never used to create new hashes.
const LEGACY_SALT = "hotel-pms::v1";

/** Reproduce a legacy SHA-256 + static-salt hash (verify/upgrade path only). */
export function legacyHash(plain: string): string {
  return createHash("sha256").update(`${LEGACY_SALT}:${plain}`).digest("hex");
}

/** Hash a password with scrypt and a fresh random salt. Returns the versioned string. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
  return [
    "scrypt",
    "v1",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join(":");
}

export interface VerifyResult {
  valid: boolean;
  /** True when the stored hash is legacy and should be re-hashed to scrypt. */
  needsUpgrade: boolean;
}

/** Verify a password against a stored hash (new scrypt format or legacy SHA-256). */
export function verifyPassword(plain: string, stored: string): VerifyResult {
  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    if (parts.length !== 7) return { valid: false, needsUpgrade: false };
    const [, , n, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, "base64");
    let actual: Buffer;
    try {
      actual = scryptSync(plain, Buffer.from(saltB64, "base64"), expected.length, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: SCRYPT.maxmem,
      });
    } catch {
      return { valid: false, needsUpgrade: false };
    }
    const valid = actual.length === expected.length && timingSafeEqual(actual, expected);
    return { valid, needsUpgrade: false };
  }

  // Legacy SHA-256 (static salt): constant-length hex compare, flag for upgrade.
  const candidate = legacyHash(plain);
  const valid =
    stored.length === candidate.length &&
    timingSafeEqual(Buffer.from(candidate), Buffer.from(stored));
  return { valid, needsUpgrade: valid };
}
