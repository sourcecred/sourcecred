// @flow

import {parseLinks} from "./references";

describe("plugins/discourse/references", () => {
  describe("parseLinks", () => {
    it("does not error on empty string", () => {
      expect(parseLinks("")).toEqual([]);
    });
    it("does not error on non-html", () => {
      expect(parseLinks("foo bar")).toEqual([]);
    });
    it("does not pick up raw urls", () => {
      expect(parseLinks("https://www.google.com")).toEqual([]);
    });
    it("picks up a (https://) hyperlink in href", () => {
      expect(parseLinks(`<a href="https://www.google.com">A Link</a>`)).toEqual(
        ["https://www.google.com"]
      );
    });
    it("picks up a (http://) hyperlink in href", () => {
      expect(parseLinks(`<a href="http://www.google.com">A Link</a>`)).toEqual([
        "http://www.google.com",
      ]);
    });
    it("doesn't pick up anchor hrefs", () => {
      expect(parseLinks(`<a href="#foo">A Link</a>`)).toEqual([]);
    });
  });
});
