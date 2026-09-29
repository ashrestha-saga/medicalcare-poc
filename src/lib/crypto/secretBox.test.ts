import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  decryptSecretOrPlain,
  encryptSecret,
  isSecretBoxPayload,
} from "@/lib/crypto/secretBox";
import { stageForDueDate } from "@/services/jobs/dueDateReminderJob";

describe("secretBox", () => {
  it("round-trips encryption", () => {
    const enc = encryptSecret("oxid-token", "test-key");
    expect(isSecretBoxPayload(enc)).toBe(true);
    expect(decryptSecret(enc, "test-key")).toBe("oxid-token");
  });

  it("dual-read returns plaintext unchanged", () => {
    expect(decryptSecretOrPlain("plain-token", "test-key")).toBe("plain-token");
  });
});

describe("stageForDueDate", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");

  it("selects stages by day distance", () => {
    expect(stageForDueDate(new Date("2027-02-01T00:00:00.000Z"), now)).toBeNull();
    expect(stageForDueDate(new Date("2026-11-01T00:00:00.000Z"), now)).toBe("T-90");
    expect(stageForDueDate(new Date("2026-10-15T00:00:00.000Z"), now)).toBe("T-30");
    expect(stageForDueDate(new Date("2026-10-01T00:00:00.000Z"), now)).toBe("T-7");
    expect(stageForDueDate(new Date("2026-09-28T00:00:00.000Z"), now)).toBe("due");
    expect(stageForDueDate(new Date("2026-09-20T00:00:00.000Z"), now)).toBe("overdue");
  });
});
