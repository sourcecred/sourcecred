// @flow

import {parseServerUrl} from "./models";

describe("plugins/discourse/models", () => {
  describe("parseServerUrl", () => {
    it("should work with valid server URLs", () => {
      const expected = [
        {serverUrl: "https://foo.bar", normalizedUrl: "https://foo.bar"},
        {
          serverUrl: "http://example.com/",
          normalizedUrl: "http://example.com",
        },
        {
          serverUrl: "HTTPS://Casing.WTF",
          normalizedUrl: "https://casing.wtf",
        },
        {
          serverUrl: "https://custom.port.wtf:9001",
          normalizedUrl: "https://custom.port.wtf:9001",
        },
        {
          serverUrl: "http://default.port.wtf:80",
          normalizedUrl: "http://default.port.wtf",
        },
        {
          serverUrl: "https://default.port.wtf:443",
          normalizedUrl: "https://default.port.wtf",
        },
        {
          serverUrl: "https://discourse.sourcecred.io/",
          normalizedUrl: "https://discourse.sourcecred.io",
        },
      ];

      const actual = expected.map(({serverUrl}) => ({
        serverUrl,
        normalizedUrl: parseServerUrl(serverUrl),
      }));

      expect(expected).toEqual(actual);
    });

    it("should fail on invalid server urls", () => {
      const expected = {
        "file:///dev/null": (url) =>
          `Provided Discourse Server URL was invalid: ${url}\n` +
          `URL should have a http/https protocol`,
        "http://user:pass@foo.bar": (url) =>
          `Provided Discourse Server URL was invalid: ${url}\n` +
          `Only a hostname and port are allowed`,
        "http://foo.bar/path": (url) =>
          `Provided Discourse Server URL was invalid: ${url}\n` +
          `Only a hostname and port are allowed`,
        "http://foo.bar/?search": (url) =>
          `Provided Discourse Server URL was invalid: ${url}\n` +
          `Only a hostname and port are allowed`,
        "http://foo.bar/#hash": (url) =>
          `Provided Discourse Server URL was invalid: ${url}\n` +
          `Only a hostname and port are allowed`,
      };

      for (const url in expected) {
        expect(() => parseServerUrl(url)).toThrow(expected[url](url));
      }
    });
  });
});
