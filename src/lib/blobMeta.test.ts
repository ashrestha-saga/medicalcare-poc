import { describe, expect, it } from "vitest";
import { blobMetaFromDataUrl } from "@/lib/blobMeta";

describe("blobMetaFromDataUrl", () => {
  it("parses jpeg base64 payload size", () => {
    const dataUrl = "data:image/jpeg;base64,QQ==";
    const meta = blobMetaFromDataUrl(dataUrl);
    expect(meta.contentType).toBe("image/jpeg");
    expect(meta.byteSize).toBe(1);
  });

  it("returns nulls for non-data URLs", () => {
    expect(blobMetaFromDataUrl("https://example.com/a.jpg")).toEqual({
      contentType: null,
      byteSize: null,
    });
  });
});
