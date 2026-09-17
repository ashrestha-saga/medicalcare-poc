import { describe, expect, it } from "vitest";
import { mapOxidArticleToDeviceModel, oxeanLookupValues } from "@/services/adapters/oxidHttpAdapter";
import { mapTokenResponse } from "@/services/oxid/oxidAuthService";
import { mapMeToSessionUser } from "@/services/oxid/oxidProfile";

describe("oxidAuthService mappers", () => {
  it("maps RFC token responses", () => {
    const t = mapTokenResponse({
      access_token: "at-1",
      token_type: "Bearer",
      expires_in: 120,
      refresh_token: "rt-1",
      scope: "profile address api",
    });
    expect(t.accessToken).toBe("at-1");
    expect(t.refreshToken).toBe("rt-1");
    expect(t.tokenType).toBe("Bearer");
    expect(t.scope).toBe("profile address api");
    expect(t.expiresAt).toBeGreaterThan(Date.now());
  });

  it("maps Merzljak /oauth/me profile to SessionUser", () => {
    const user = mapMeToSessionUser({
      oxid: "c445773025d1fbb04324b0bdb94b669e",
      first_name: "Anish",
      last_name: "Shrestha",
      email: "a.shrestha01@merzljak.de",
      custnr: "679999",
      company: "Merzljak W/V GmbH",
      street: "Hirschberger 12",
      zip: "53119",
      city: "Bonn",
      billing: { street: "Hirschberger 12", zip: "53119", city: "Bonn" },
      addresses: [
        { company: "MW", street: "Musterstr.", street_no: "100", zip: "53111", city: "Bonn" },
      ],
    });
    expect(user.id).toBe("c445773025d1fbb04324b0bdb94b669e");
    expect(user.name).toBe("Anish Shrestha");
    expect(user.role).toBe("user");
    expect(user.companyName).toBe("Merzljak W/V GmbH");
    expect(user.customerNumber).toBe("679999");
    expect(user.deliveryLine).toBe("Hirschberger 12 · 53119 Bonn");
    expect(user.tenantId).toBe("demo-tenant");
  });
});

describe("oxidHttp catalog mapper", () => {
  it("maps article rows looked up by oxean", () => {
    const model = mapOxidArticleToDeviceModel(
      {
        OXID: "art-1",
        OXARTNUM: "ART-001",
        OXTITLE: "Infusion set",
        OXEAN: "04012345678932",
        OXMANUFACTURERNAME: "Example Medical",
      },
      "04012345678932",
    );
    expect(model.id).toBe("art-1");
    expect(model.tradeName).toBe("Infusion set");
    expect(model.modelName).toBe("ART-001");
    expect(model.gtins).toEqual(["04012345678932"]);
    expect(model.manufacturer).toBe("Example Medical");
    expect(model.source).toBe("catalog");
  });
});

describe("oxeanLookupValues", () => {
  it("puts unpadded shop EAN before GTIN-14", () => {
    expect(oxeanLookupValues("04260698610998", "4260698610998")).toEqual([
      "4260698610998",
      "04260698610998",
    ]);
  });
});
