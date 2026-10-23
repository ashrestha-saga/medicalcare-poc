import { describe, expect, it } from "vitest";
import {
  executorCodeForOrg,
  INTERNAL_EXECUTOR_CODE,
  isExecutorAllocatable,
} from "@/services/contracts/executorSyncService";

describe("executorSyncService", () => {
  it("builds O-{code} executor codes", () => {
    expect(executorCodeForOrg("MSR")).toBe("O-MSR");
    expect(executorCodeForOrg("RTS")).toBe("O-RTS");
  });

  it("keeps internal executors allocatable", () => {
    const contracted = new Set(["org-msr"]);
    const live = new Set(["org-msr"]);
    expect(
      isExecutorAllocatable(
        { kind: "internal", code: INTERNAL_EXECUTOR_CODE, organisationId: null },
        contracted,
        live,
      ),
    ).toBe(true);
  });

  it("keeps external executors without a contract row (inspection-only)", () => {
    const contracted = new Set(["org-msr"]);
    const live = new Set(["org-msr"]);
    expect(
      isExecutorAllocatable(
        { kind: "external", code: "O-RTS", organisationId: "org-rts" },
        contracted,
        live,
      ),
    ).toBe(true);
  });

  it("hides contracted executors when the contract is not live", () => {
    const contracted = new Set(["org-msr"]);
    const live = new Set<string>();
    expect(
      isExecutorAllocatable(
        { kind: "external", code: "O-MSR", organisationId: "org-msr" },
        contracted,
        live,
      ),
    ).toBe(false);
  });

  it("shows contracted executors while the contract is live", () => {
    const contracted = new Set(["org-msr"]);
    const live = new Set(["org-msr"]);
    expect(
      isExecutorAllocatable(
        { kind: "external", code: "O-MSR", organisationId: "org-msr" },
        contracted,
        live,
      ),
    ).toBe(true);
  });
});
