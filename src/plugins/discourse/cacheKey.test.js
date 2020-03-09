// @flow

import {parseServerUrl} from "./models";
import {cacheKey} from "./cacheKey";

describe("plugins/discourse/cacheKey", () => {
  describe("cacheKey", () => {
    it("should work with valid server URLs", () => {
      const expected = [
        {serverUrl: "https://foo.bar", cacheKey: "discourse_https_foo.bar"},
        {
          serverUrl: "http://example.com/",
          cacheKey: "discourse_http_example.com",
        },
        {
          serverUrl: "HTTPS://Casing.WTF",
          cacheKey: "discourse_https_casing.wtf",
        },
        {
          serverUrl: "https://custom.port.wtf:9001",
          cacheKey: "discourse_https_custom.port.wtf_9001",
        },
        {
          serverUrl: "http://default.port.wtf:80",
          cacheKey: "discourse_http_default.port.wtf",
        },
        {
          serverUrl: "https://default.port.wtf:443",
          cacheKey: "discourse_https_default.port.wtf",
        },
        {
          serverUrl: "https://discourse.sourcecred.io/",
          cacheKey: "discourse_https_discourse.sourcecred.io",
        },
      ];

      const actual = expected.map(({serverUrl}) => ({
        serverUrl,
        cacheKey: cacheKey(parseServerUrl(serverUrl)),
      }));

      expect(expected).toEqual(actual);
    });
  });
});
