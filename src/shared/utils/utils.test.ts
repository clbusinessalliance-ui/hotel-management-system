import { describe, it, expect } from "vitest";
import { textMatch, nightsBetween, formatMoney } from "./index.ts";

describe("textMatch", () => {
  it("matches any field, case-insensitively", () => {
    expect(textMatch(["Ada Lovelace", "201"], "ada")).toBe(true);
    expect(textMatch(["Ada Lovelace", "201"], "20")).toBe(true);
    expect(textMatch(["Ada Lovelace", "201"], "ZZZ")).toBe(false);
  });

  it("treats an empty/whitespace query as match-all", () => {
    expect(textMatch(["anything"], "")).toBe(true);
    expect(textMatch(["anything"], "   ")).toBe(true);
  });

  it("ignores undefined fields", () => {
    expect(textMatch([undefined, "confirmed"], "confirmed")).toBe(true);
    expect(textMatch([undefined], "x")).toBe(false);
  });
});

describe("utility math sanity", () => {
  it("nightsBetween counts whole nights", () => {
    expect(nightsBetween("2026-06-12", "2026-06-15")).toBe(3);
  });
  it("formatMoney renders minor units", () => {
    expect(formatMoney(12000, "USD")).toContain("120");
  });
});
