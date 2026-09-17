import { describe, expect, it } from "vitest";
import {
  beudamedLookupIds,
  mapBeudamedToDeviceModel,
} from "@/services/adapters/beudamedAdapters";

describe("beudamedLookupIds", () => {
  it("tries padded then unpadded primary DI", () => {
    expect(beudamedLookupIds("06970401810666")).toEqual(["06970401810666", "6970401810666"]);
    expect(beudamedLookupIds("04260698610998")).toEqual(["04260698610998", "4260698610998"]);
  });
});

describe("mapBeudamedToDeviceModel", () => {
  const at = new Date("2026-01-01T00:00:00.000Z");

  it("maps OpenAPI EudamedDevice", () => {
    const model = mapBeudamedToDeviceModel(
      {
        id: "06970401810666",
        provider: "eudamed",
        type: "device",
        primary_di: "06970401810666",
        name: "Sample Device",
        basic_udi_di: "06970401BASIC01",
        manufacturer_name: "Acme Med",
        classification: "IIb",
        cnd_nomenclatures: [{ code: "Z120401", description: "Defib" }],
      },
      "06970401810666",
      at,
    );
    expect(model.udiDi).toBe("06970401810666");
    expect(model.basicUdiDi).toBe("06970401BASIC01");
    expect(model.tradeName).toBe("Sample Device");
    expect(model.manufacturer).toBe("Acme Med");
    expect(model.riskClass).toBe("IIb");
    expect(model.emdnCode).toBe("Z120401");
    expect(model.source).toBe("beudamed");
  });

  it("maps OpenAPI FdaUdi by primary DI", () => {
    const model = mapBeudamedToDeviceModel(
      {
        id: "06970401810666",
        type: "fda_udi",
        primary_di: "06970401810666",
        brand_name: "Accu Sample",
        company_name: "Roche",
        version_or_model_number: "AS-1",
        gmdn_terms: [{ code: "40761", name: "Pump" }],
      },
      "06970401810666",
      at,
    );
    expect(model.udiDi).toBe("06970401810666");
    expect(model.tradeName).toBe("Accu Sample");
    expect(model.manufacturer).toBe("Roche");
    expect(model.modelName).toBe("AS-1");
    expect(model.gmdnCode).toBe("40761");
  });
});
