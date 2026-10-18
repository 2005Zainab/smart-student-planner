import { describe, it, expect } from "vitest";
import { validateLinks, validateTaskFields } from "./taskValidation.js";

describe("validateLinks", () => {
  it("accepts http and https links and trims whitespace", () => {
    const result = validateLinks(["  https://example.com/page  ", "http://example.com"]);

    expect(result.message).toBeUndefined();
    expect(result.cleanLinks).toEqual(["https://example.com/page", "http://example.com"]);
  });

  it("accepts an empty list", () => {
    expect(validateLinks([]).cleanLinks).toEqual([]);
  });

  it("rejects links that are not an array", () => {
    expect(validateLinks("https://example.com").message).toMatch(/Array/);
  });

  it("rejects non-string links", () => {
    expect(validateLinks([123]).message).toMatch(/string/i);
  });

  it("rejects empty or blank links", () => {
    expect(validateLinks(["   "]).message).toMatch(/empty/i);
  });

  it("rejects links that are not valid URLs", () => {
    expect(validateLinks(["not a url"]).message).toMatch(/valid URL/i);
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "data:text/html,hi"])(
    "rejects unsafe or unsupported protocol: %s",
    link => {
      expect(validateLinks([link]).message).toMatch(/http/i);
    },
  );

  it("rejects a link over 500 characters", () => {
    const longLink = `https://example.com/${"a".repeat(500)}`;

    expect(validateLinks([longLink]).message).toMatch(/length/i);
  });

  it("allows exactly 10 links but rejects 11", () => {
    const makeLinks = count => Array.from({ length: count }, (_, i) => `https://example.com/${i}`);

    expect(validateLinks(makeLinks(10)).cleanLinks).toHaveLength(10);
    expect(validateLinks(makeLinks(11)).message).toMatch(/Too many/i);
  });
});

describe("validateTaskFields with links", () => {
  it("defaults links to an empty list when creating a task", () => {
    const result = validateTaskFields({
      title: "Essay",
      description: "",
      subject: "",
      status: "To Do",
    });

    expect(result.clean.links).toEqual([]);
  });

  it("only includes links in a partial update when links are sent", () => {
    expect(validateTaskFields({ links: ["https://example.com"] }, { partial: true }).clean).toEqual(
      { links: ["https://example.com"] },
    );

    expect(validateTaskFields({ title: "New" }, { partial: true }).clean).not.toHaveProperty(
      "links",
    );
  });

  it("returns the link error message from the validator", () => {
    const result = validateTaskFields({ links: ["javascript:alert(1)"] }, { partial: true });

    expect(result.message).toMatch(/http/i);
  });
});
