import { describe, expect, it } from "vitest";
import { buildStoreZip, crc32, safeZipName } from "./storeZip";

describe("storeZip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("writes a readable archive with end-of-central-directory", () => {
    const zip = buildStoreZip([
      { name: "a.txt", data: Buffer.from("hello") },
      { name: "dir/b.txt", data: Buffer.from("world") },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(zip.readUInt32LE(eocd)).toBe(0x06054b50);
    expect(zip.readUInt16LE(eocd + 10)).toBe(2);
    expect(zip.includes(Buffer.from("hello"))).toBe(true);
  });

  it("is deterministic and neutralises path traversal", () => {
    const entries = [{ name: "../../etc/passwd", data: Buffer.from("x") }];
    expect(buildStoreZip(entries).equals(buildStoreZip(entries))).toBe(true);
    expect(safeZipName("../../etc/passwd")).toBe("etc/passwd");
  });
});
