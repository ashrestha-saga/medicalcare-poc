import { describe, expect, it } from "vitest";
import {
  deviceMatchesScope,
  filterCandidateDevices,
  serialInRange,
} from "./fieldSafetyCandidates";

describe("serialInRange", () => {
  it("allows any serial when bounds empty", () => {
    expect(serialInRange("ABC", null, null)).toBe(true);
    expect(serialInRange(null, null, null)).toBe(true);
  });
  it("rejects missing serial when bounds set", () => {
    expect(serialInRange(null, "A", "Z")).toBe(false);
  });
  it("checks lexicographic bounds", () => {
    expect(serialInRange("M100", "A000", "Z999")).toBe(true);
    expect(serialInRange("099", "100", "200")).toBe(false);
    expect(serialInRange("150", "100", "200")).toBe(true);
  });
});

describe("deviceMatchesScope", () => {
  const device = {
    id: "d1",
    modelId: "m1",
    serialNumber: "SN-100",
    modelBasicUdiDi: "UDI-X",
  };

  it("matches by model id and serial range", () => {
    expect(
      deviceMatchesScope(device, {
        deviceModelId: "m1",
        basicUdiDi: null,
        serialFrom: "SN-050",
        serialTo: "SN-200",
      }),
    ).toBe(true);
  });

  it("matches by basic UDI-DI", () => {
    expect(
      deviceMatchesScope(device, {
        deviceModelId: null,
        basicUdiDi: "UDI-X",
        serialFrom: null,
        serialTo: null,
      }),
    ).toBe(true);
  });

  it("rejects wrong model", () => {
    expect(
      deviceMatchesScope(device, {
        deviceModelId: "other",
        basicUdiDi: null,
        serialFrom: null,
        serialTo: null,
      }),
    ).toBe(false);
  });
});

describe("filterCandidateDevices", () => {
  it("dedupes devices matching multiple scopes", () => {
    const devices = [
      { id: "a", modelId: "m1", serialNumber: "1", modelBasicUdiDi: null },
      { id: "b", modelId: "m2", serialNumber: "2", modelBasicUdiDi: null },
    ];
    const out = filterCandidateDevices(devices, [
      { deviceModelId: "m1", basicUdiDi: null, serialFrom: null, serialTo: null },
      { deviceModelId: "m1", basicUdiDi: null, serialFrom: "0", serialTo: "9" },
    ]);
    expect(out.map((d) => d.id)).toEqual(["a"]);
  });
});
