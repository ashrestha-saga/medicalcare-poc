import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes and verifies", () => {
    const encoded = hashPassword("demo");
    expect(encoded.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("demo", encoded)).toBe(true);
    expect(verifyPassword("wrong", encoded)).toBe(false);
  });
});
