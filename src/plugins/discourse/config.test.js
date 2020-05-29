// @flow

import {parseConfig} from "./config";

describe("plugins/discourse/config", () => {
  describe("parseConfig", () => {
    it("works on a config with just a serverUrl", () => {
      const config = {serverUrl: "https://server.io"};
      expect(parseConfig(config)).toEqual(config);
    });
    it("errors if the serverUrl is not a url", () => {
      const config = {serverUrl: "1234"};
      expect(() => parseConfig(config)).toThrowError();
    });
    it("errors if the serverUrl is not a string", () => {
      const config = {serverUrl: 234};
      expect(() => parseConfig(config)).toThrowError();
    });
    it("errors if the serverUrl is missing", () => {
      const config = {};
      expect(() => parseConfig(config)).toThrowError();
    });
    it("errors if the config is not an object", () => {
      const config = [];
      expect(() => parseConfig(config)).toThrowError();
    });
    it("works on a config with mirror options", () => {
      const config = {
        serverUrl: "https://server.io",
        mirrorOptions: {
          recheckCategoryDefinitionsAfterMs: 12,
          recheckTopicsInCategories: [1, 2, 3, 4],
        },
      };
      expect(parseConfig(config)).toEqual(config);
    });
    it("errors on a config with missing mirror options", () => {
      const c1 = {
        serverUrl: "https://server.io",
        mirrorOptions: {
          recheckTopicsInCategories: [1, 2, 3, 4],
        },
      };
      expect(() => parseConfig(c1)).toThrowError();
      const c2 = {
        serverUrl: "https://server.io",
        mirrorOptions: {
          recheckCategoryDefinitionsAfterMs: 12,
        },
      };
      expect(() => parseConfig(c2)).toThrowError();
    });
    it("errors with bad config options", () => {
      const c1 = {
        serverUrl: "https://server.io",
        mirrorOptions: {
          recheckTopicsInCategories: 12,
          recheckCategoryDefinitionsAfterMs: 12,
        },
      };
      expect(() => parseConfig(c1)).toThrowError();
      const c2 = {
        serverUrl: "https://server.io",
        mirrorOptions: {
          recheckTopicsInCategories: [1, 2, 3, 4],
          recheckCategoryDefinitionsAfterMs: "foo",
        },
      };
      expect(() => parseConfig(c2)).toThrowError();
    });
  });
});
