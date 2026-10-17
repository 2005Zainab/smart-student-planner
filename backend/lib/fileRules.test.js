import { describe, it, expect } from "vitest";
import { cleanFileName, getVerifiedMimeType } from "./fileRules.js";

describe("cleanFileName", () => {
  it.each([
    ["C:\\Users\\me\\notes.pdf", "notes.pdf"],
    ["../../secret/notes.pdf", "notes.pdf"],
    ["", "file"],
    [undefined, "file"],
  ])("cleans %j to %j", (input, expected) => {
    expect(cleanFileName(input)).toBe(expected);
  });
});

describe("getVerifiedMimeType", () => {
  it.each([
    ["a.pdf", Buffer.from("%PDF-1.4"), "application/pdf"],
    ["a.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]), "image/png"],
    ["a.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
  ])("accepts %s when the bytes match", (name, bytes, mimeType) => {
    expect(getVerifiedMimeType(name, bytes)).toBe(mimeType);
  });

  it("rejects a file whose bytes don't match its extension", () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);

    expect(getVerifiedMimeType("fake.pdf", pngBytes)).toBeNull();
  });
});
