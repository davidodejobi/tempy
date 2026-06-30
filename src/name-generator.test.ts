import { describe, it, expect } from "vitest";
import { generateLocalPart } from "./name-generator.js";

describe("generateLocalPart", () => {
  it("is lowercase letters followed by a 1-2 digit number", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateLocalPart()).toMatch(/^[a-z]+[0-9]{1,2}$/);
    }
  });

  it("produces varied values", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateLocalPart());
    expect(seen.size).toBeGreaterThan(1);
  });

  it("is a reasonable length for an email local-part", () => {
    const name = generateLocalPart();
    expect(name.length).toBeGreaterThanOrEqual(4);
    expect(name.length).toBeLessThanOrEqual(40);
  });
});
