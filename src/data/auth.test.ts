import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, legacyHash } from "./auth.ts";

describe("password hashing (scrypt)", () => {
  it("uses the versioned scrypt format with a per-user random salt", () => {
    const a = hashPassword("hunter2");
    const b = hashPassword("hunter2");
    expect(a.startsWith("scrypt:v1:")).toBe(true);
    expect(a).not.toBe(b); // different random salt each time
    expect(a.split(":")).toHaveLength(7);
  });

  it("verifies a correct password", () => {
    const stored = hashPassword("correct horse");
    const r = verifyPassword("correct horse", stored);
    expect(r.valid).toBe(true);
    expect(r.needsUpgrade).toBe(false);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("correct horse");
    expect(verifyPassword("wrong", stored).valid).toBe(false);
  });

  it("still verifies a legacy SHA-256 hash and flags it for upgrade", () => {
    const stored = legacyHash("admin");
    const r = verifyPassword("admin", stored);
    expect(r.valid).toBe(true);
    expect(r.needsUpgrade).toBe(true);
    expect(verifyPassword("nope", stored).valid).toBe(false);
  });
});
