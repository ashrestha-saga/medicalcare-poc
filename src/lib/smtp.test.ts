import { describe, expect, it } from "vitest";
import { parseSmtpAuth } from "@/lib/smtp";

describe("parseSmtpAuth", () => {
  it("parses a complete DispatchTarget.auth blob", () => {
    expect(
      parseSmtpAuth({
        host: "ssl.mhosts.de",
        port: 587,
        secure: false,
        user: "noreply@mhosts.de",
        pass: "123456",
        from: "noreply@mhosts.de",
      }),
    ).toEqual({
      host: "ssl.mhosts.de",
      port: 587,
      secure: false,
      user: "noreply@mhosts.de",
      pass: "123456",
      from: "noreply@mhosts.de",
    });
  });

  it("rejects incomplete auth", () => {
    expect(parseSmtpAuth({ host: "ssl.mhosts.de", port: 587 })).toBeNull();
    expect(parseSmtpAuth(null)).toBeNull();
  });
});
