import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IMPORT_TEMPLATE_SHA256 } from "../../../prisma/seeds/importDictionary";

describe("E82 template SHA-256 (A34)", () => {
  it("matches seeded constant", () => {
    const bytes = readFileSync(
      join(process.cwd(), "public/import/devicecare-vorlage-bestandsverzeichnis.xlsx"),
    );
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(sha).toBe(IMPORT_TEMPLATE_SHA256);
  });
});
