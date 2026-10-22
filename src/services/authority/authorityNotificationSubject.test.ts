import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  assertExactlyOneSubject,
  requiredPermissionForNotification,
} from "@/services/authority/authorityNotificationService";

describe("assertExactlyOneSubject", () => {
  it("accepts exactly one subject", () => {
    expect(() => assertExactlyOneSubject({ incidentId: "i1" })).not.toThrow();
    expect(() => assertExactlyOneSubject({ findingId: "f1" })).not.toThrow();
    expect(() => assertExactlyOneSubject({ deviceInstanceId: "d1" })).not.toThrow();
    expect(() => assertExactlyOneSubject({ siteId: "s1" })).not.toThrow();
  });

  it("rejects zero or multiple subjects", () => {
    expect(() => assertExactlyOneSubject({})).toThrow(AppError);
    expect(() =>
      assertExactlyOneSubject({ incidentId: "i1", findingId: "f1" }),
    ).toThrow(AppError);
  });
});

describe("requiredPermissionForNotification", () => {
  it("requires incidents:manage for incident notifications", () => {
    expect(requiredPermissionForNotification({ kind: "incident", incidentId: "i1" })).toBe(
      "incidents:manage",
    );
  });

  it("requires authority:view for finding/device/site kinds", () => {
    expect(requiredPermissionForNotification({ kind: "finding_remediation" })).toBe(
      "authority:view",
    );
    expect(requiredPermissionForNotification({ kind: "radiation" })).toBe("authority:view");
  });
});
