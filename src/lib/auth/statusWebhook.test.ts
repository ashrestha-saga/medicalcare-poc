import { describe, expect, it } from "vitest";
import { hmacHex } from "@/lib/crypto";
import { assertStatusWebhook } from "./statusWebhook";

describe("assertStatusWebhook", () => {
  it("accepts a matching sha256 signature", () => {
    const prev = process.env.STATUS_WEBHOOK_SECRET;
    process.env.STATUS_WEBHOOK_SECRET = "test-secret";
    const body = JSON.stringify({ state: "acknowledged" });
    expect(() => assertStatusWebhook(body, `sha256=${hmacHex("test-secret", body)}`)).not.toThrow();
    process.env.STATUS_WEBHOOK_SECRET = prev;
  });

  it("rejects a missing or wrong signature", () => {
    const prev = process.env.STATUS_WEBHOOK_SECRET;
    process.env.STATUS_WEBHOOK_SECRET = "test-secret";
    expect(() => assertStatusWebhook("{}", null)).toThrow(/Invalid status signature/);
    expect(() => assertStatusWebhook("{}", "sha256=deadbeef")).toThrow(/Invalid status signature/);
    process.env.STATUS_WEBHOOK_SECRET = prev;
  });
});
