import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertPartsProposalOwnership } from "./partsProposalService";

describe("assertPartsProposalOwnership", () => {
  const base = {
    assigneeUserId: "tech-1",
    executorOrganisationId: "org-1",
    callerUserId: "tech-1",
    organisationId: "org-1",
    canDispositionAssign: false,
  };

  it("allows the assignee on the executing org", () => {
    expect(() => assertPartsProposalOwnership(base)).not.toThrow();
  });

  it("allows a disposition lead on the executing org", () => {
    expect(() =>
      assertPartsProposalOwnership({
        ...base,
        callerUserId: "lead-1",
        canDispositionAssign: true,
      }),
    ).not.toThrow();
  });

  it("rejects a non-assignee without disposition permission", () => {
    expect(() =>
      assertPartsProposalOwnership({
        ...base,
        callerUserId: "other-tech",
        canDispositionAssign: false,
      }),
    ).toThrow(AppError);
  });

  it("rejects wrong organisation even for the assignee", () => {
    expect(() =>
      assertPartsProposalOwnership({
        ...base,
        organisationId: "org-other",
      }),
    ).toThrow(AppError);
  });

  it("rejects when executor organisation is unset", () => {
    expect(() =>
      assertPartsProposalOwnership({
        ...base,
        executorOrganisationId: null,
      }),
    ).toThrow(AppError);
  });
});
