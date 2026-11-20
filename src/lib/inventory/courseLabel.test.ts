import { describe, expect, it } from "vitest";
import { courseLabelFromUnitEvent, readableCourseLabel } from "./courseLabel";

describe("readableCourseLabel", () => {
  it("hides snapshot ids and organisation uuids", () => {
    expect(
      readableCourseLabel(
        "Model reclassification — snapshot cmuy99ysy00bgs61pu28ngzhq (all copies of model-pump-x200)",
      ),
    ).toBe("Model reclassification — classification update (all copies of model-pump-x200)");
    expect(
      readableCourseLabel(
        "Maintenance per manufacturer specification — next due 2027-10-07 — org 1f0f2544-0dc8-5869-9c13-85f741e48258",
      ),
    ).toBe("Maintenance per manufacturer specification — next due 2027-10-07");
  });
});

describe("courseLabelFromUnitEvent", () => {
  it("formats import create and update lines", () => {
    expect(courseLabelFromUnitEvent("imported", "aus file.xlsx, Blatt A, Zeile 2")).toBe(
      "Imported · aus file.xlsx, Blatt A, Zeile 2",
    );
    expect(courseLabelFromUnitEvent("import_updated", "aus file.xlsx, Blatt A, Zeile 2 (SN→X)")).toBe(
      "Import update · aus file.xlsx, Blatt A, Zeile 2 (SN→X)",
    );
  });
});
