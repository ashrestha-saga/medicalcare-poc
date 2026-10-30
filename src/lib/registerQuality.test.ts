import { describe, expect, it } from "vitest";
import {
  looksLikeKeyboardMash,
  looksLikeTestLabel,
  shouldHideFromRegisterDevice,
  shouldHideFromRegisterIncident,
} from "./registerQuality";

describe("looksLikeTestLabel", () => {
  it("matches test labels and D-codes", () => {
    expect(looksLikeTestLabel("Test 1")).toBe(true);
    expect(looksLikeTestLabel("test2")).toBe(true);
    expect(looksLikeTestLabel("D12abc")).toBe(true);
  });

  it("ignores real text", () => {
    expect(looksLikeTestLabel("Testgerät Labor")).toBe(false);
    expect(looksLikeTestLabel("D12")).toBe(false);
    expect(looksLikeTestLabel("")).toBe(false);
    expect(looksLikeTestLabel(null)).toBe(false);
  });
});

describe("looksLikeKeyboardMash", () => {
  it("flags consonant mash and repeated chars", () => {
    expect(looksLikeKeyboardMash("asdfghjkl")).toBe(true);
    expect(looksLikeKeyboardMash("qwrtp")).toBe(true);
    expect(looksLikeKeyboardMash("aaaaa")).toBe(true);
  });

  it("keeps normal words, long text, spaces and codes", () => {
    expect(looksLikeKeyboardMash("Infusion")).toBe(false);
    expect(looksLikeKeyboardMash("Siemens")).toBe(false);
    expect(looksLikeKeyboardMash("Pump failed again")).toBe(false);
    expect(looksLikeKeyboardMash("SN-12345-678")).toBe(false);
    expect(looksLikeKeyboardMash("A12345")).toBe(false);
    expect(looksLikeKeyboardMash(undefined)).toBe(false);
  });
});

describe("shouldHideFromRegisterDevice", () => {
  it("hides when any field is junk", () => {
    expect(shouldHideFromRegisterDevice({ inventoryNumber: "INV-1", name: "Test 3" })).toBe(true);
    expect(shouldHideFromRegisterDevice({ inventoryNumber: "INV-1", room: "kjhgf" })).toBe(true);
  });

  it("keeps real devices", () => {
    expect(
      shouldHideFromRegisterDevice({
        inventoryNumber: "INV-1001",
        name: "Perfusor Space",
        manufacturer: "B. Braun",
        serialNumber: "SN-4711",
        room: "OP 2",
      }),
    ).toBe(false);
    expect(shouldHideFromRegisterDevice({ manufacturer: "GmbH" })).toBe(false);
  });
});

describe("shouldHideFromRegisterIncident", () => {
  it("hides junk descriptions", () => {
    expect(shouldHideFromRegisterIncident({ description: "asdfgh" })).toBe(true);
    expect(shouldHideFromRegisterIncident({ description: "Test 1" })).toBe(true);
  });

  it("keeps real incidents", () => {
    expect(
      shouldHideFromRegisterIncident({
        description: "Display went dark during infusion",
        harmDescription: null,
      }),
    ).toBe(false);
  });
});
