import { describe, it, expect } from "vitest";
import { AccessEngine } from "./AccessEngine.ts";
import { NoopDoorProvider } from "./adapters/NoopDoorProvider.ts";

describe("AccessEngine (brand-neutral)", () => {
  const engine = new AccessEngine(new NoopDoorProvider());

  it("reports the injected provider without knowing the brand", () => {
    expect(engine.providerName).toBe("noop");
  });

  it("issues a stay key through whatever provider is wired in", async () => {
    const res = await engine.issueStayKey({
      door: { id: "room-204" },
      holderId: "guest-1",
      validFrom: "2026-06-12T14:00:00Z",
      validUntil: "2026-06-14T11:00:00Z",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.doorId).toBe("room-204");
      expect(res.value.revoked).toBe(false);
      expect(res.value.secret).toMatch(/^\d{6}$/);
    }
  });

  it("rejects an invalid validity window", async () => {
    const res = await engine.issueStayKey({
      door: { id: "room-204" },
      holderId: "guest-1",
      validFrom: "2026-06-14T11:00:00Z",
      validUntil: "2026-06-12T14:00:00Z",
    });
    expect(res.ok).toBe(false);
  });
});
