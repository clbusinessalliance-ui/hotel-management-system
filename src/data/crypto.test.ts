import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { createFieldCipher } from "./crypto.ts";

describe("field encryption", () => {
  const key = randomBytes(32);
  const cipher = createFieldCipher(key);

  it("round-trips plaintext", () => {
    const secret = "123456";
    const ct = cipher.encrypt(secret);
    expect(ct).not.toContain(secret);
    expect(cipher.decrypt(ct)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(cipher.encrypt("abc")).not.toBe(cipher.encrypt("abc"));
  });

  it("fails to decrypt tampered ciphertext", () => {
    const ct = cipher.encrypt("DEADBEEFCAFE0001");
    const tampered = ct.slice(0, -2) + (ct.endsWith("A") ? "B" : "A");
    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  it("decrypts across cipher instances built from the SAME key (persistence guarantee)", () => {
    const ct = createFieldCipher(key).encrypt("card-token-001");
    // Simulates a later launch: a fresh cipher from the same stored key still decrypts.
    expect(createFieldCipher(key).decrypt(ct)).toBe("card-token-001");
  });

  it("cannot decrypt with a different key", () => {
    const ct = cipher.encrypt("secret");
    expect(() => createFieldCipher(randomBytes(32)).decrypt(ct)).toThrow();
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => createFieldCipher(randomBytes(16))).toThrow();
  });
});
