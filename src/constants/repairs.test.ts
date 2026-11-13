import { describe, expect, it } from "vitest";
import {
  canonicalServiceType,
  inspectionTypeCodeForServiceRequest,
  postRepairCheckByClass,
} from "./repairs";

describe("canonicalServiceType", () => {
  it("maps fixture aliases to repair / post_repair_check", () => {
    expect(canonicalServiceType("REPAIR")).toBe("repair");
    expect(canonicalServiceType("instandsetzung")).toBe("repair");
    expect(canonicalServiceType("pruefung_nach_instandsetzung")).toBe("post_repair_check");
    expect(canonicalServiceType("STK")).toBe("STK");
  });
});

describe("inspectionTypeCodeForServiceRequest", () => {
  it("prefers duty inspection type when present", () => {
    expect(
      inspectionTypeCodeForServiceRequest({
        serviceType: "repair",
        dutyInspectionTypeCode: "MTK",
      }),
    ).toBe("MTK");
  });

  it("maps repair service types to REPAIR (K-REP), not STK", () => {
    expect(
      inspectionTypeCodeForServiceRequest({ serviceType: "repair" }),
    ).toBe("REPAIR");
    expect(
      inspectionTypeCodeForServiceRequest({ serviceType: "REPAIR" }),
    ).toBe("REPAIR");
    expect(
      inspectionTypeCodeForServiceRequest({ serviceType: "instandsetzung" }),
    ).toBe("REPAIR");
  });

  it("maps post_repair_check by checkType (E78)", () => {
    expect(
      inspectionTypeCodeForServiceRequest({
        serviceType: "post_repair_check",
        checkType: "mtk",
      }),
    ).toBe("MTK");
    expect(
      inspectionTypeCodeForServiceRequest({
        serviceType: "post_repair_check",
        checkType: "requalification",
      }),
    ).toBe("VALIDATION");
    expect(
      inspectionTypeCodeForServiceRequest({
        serviceType: "post_repair_check",
        checkType: "acceptance_constancy",
      }),
    ).toBe("CONSTANCY");
    expect(
      inspectionTypeCodeForServiceRequest({
        serviceType: "post_repair_check",
        checkType: "stk",
      }),
    ).toBe("STK");
  });

  it("falls back to STK for non-repair without duty", () => {
    expect(
      inspectionTypeCodeForServiceRequest({ serviceType: "STK" }),
    ).toBe("STK");
  });
});

describe("postRepairCheckByClass", () => {
  it("picks acceptance_constancy for radiation", () => {
    expect(postRepairCheckByClass({ radiation: true })).toBe("acceptance_constancy");
  });
  it("picks requalification for reprocessing profile", () => {
    expect(postRepairCheckByClass({ hasReprocessingProfile: true })).toBe("requalification");
  });
  it("picks mtk for annex2", () => {
    expect(postRepairCheckByClass({ annex2: true })).toBe("mtk");
  });
  it("defaults to stk", () => {
    expect(postRepairCheckByClass({})).toBe("stk");
  });
});
