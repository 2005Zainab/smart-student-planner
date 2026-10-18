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

  it("accepts UTF-8 text, including an empty file", () => {
    expect(getVerifiedMimeType("notes.txt", Buffer.from("café"))).toBe("text/plain; charset=utf-8");
    expect(getVerifiedMimeType("blank.txt", Buffer.alloc(0))).toBe("text/plain; charset=utf-8");
  });

  it("rejects a .txt file that isn't valid UTF-8", () => {
    // These bytes are valid in Windows-1252, but not UTF-8.
    expect(getVerifiedMimeType("notes.txt", Buffer.from([0xca, 0xfe, 0xba, 0xbe]))).toBeNull();
    expect(getVerifiedMimeType("notes.txt", Buffer.from([0x63, 0x61, 0x66, 0xe9]))).toBeNull();
  });

  it("rejects a file whose bytes don't match its extension", () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);

    expect(getVerifiedMimeType("fake.pdf", pngBytes)).toBeNull();
  });
});
