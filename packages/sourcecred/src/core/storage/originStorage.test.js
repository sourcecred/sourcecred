// @flow

import {createPostableLedgerStorage, OriginStorage} from "./originStorage";

const MockServerTempValue = new Map();

jest.mock("cross-fetch", () => ({
  // needed to utilize fetch as a default export.
  __esModule: true,
  default: (path, options) => {
    if (options) {
      if (options.method === "POST") {
        MockServerTempValue.set(path, options.body);
      }
    }

    switch (path) {
      case "base/validPath":
        return Promise.resolve({
          arrayBuffer: () => new Uint8Array([1, 2]).buffer,
          ok: true,
          status: 200,
          statusText: "OK",
        });
      case "/base/validPath":
        return Promise.resolve({
          arrayBuffer: () => new Uint8Array([1, 2]).buffer,
          ok: true,
          status: 200,
          statusText: "OK",
        });
      case "base/serverError":
        return Promise.resolve({
          arrayBuffer: () => new ArrayBuffer(0),
          ok: false,
          status: 500,
          statusText: "INTERNAL ERROR",
        });

      case "post/validPath":
        return Promise.resolve({
          arrayBuffer: () => MockServerTempValue.get(path),
          ok: true,
          status: 200,
          statusText: "OK",
        });
      default:
        return Promise.resolve({
          arrayBuffer: () => new ArrayBuffer(0),
          ok: false,
          status: 404,
          statusText: "NOT FOUND",
        });
    }
  },
}));

describe("core/storage/originStorage", () => {
  describe("OriginStorage", () => {
    const value = new Uint8Array([1, 2]);
    it("works when base path is empty", async () => {
      expect.hasAssertions();
      const storage = new OriginStorage("");
      const result = await storage.get("base/validPath");
      await expect(result).toEqual(value);
    });
    it("works when base is a relative path", async () => {
      expect.hasAssertions();
      const storage = new OriginStorage("base");
      const result = await storage.get("validPath");
      await expect(result).toEqual(value);
    });
    it("works when base is an absolute path", async () => {
      expect.hasAssertions();
      const storage = new OriginStorage("/base");
      const result = await storage.get("validPath");
      await expect(result).toEqual(value);
    });
    it("throws on upward traversal when the base is relative", async () => {
      expect.hasAssertions();
      const storage = new OriginStorage("base");
      const thunk = async () => storage.get("../validPath");
      await expect(thunk()).rejects.toThrow("Path traversal is not allowed");
    });
    it("throws on upward traversal when the base is absolute", async () => {
      expect.hasAssertions();
      const storage = new OriginStorage("/base/test");
      const thunk = async () => storage.get("../validPath");
      await expect(thunk()).rejects.toThrow("Path traversal is not allowed");
    });
    it("throws an error if the http response is not ok", async () => {
      expect.hasAssertions();
      const storage = new OriginStorage("base");
      const thunk = async () => storage.get("invalidPath");
      await expect(thunk()).rejects.toThrow(
        "Error fetching invalidPath: 404 NOT FOUND"
      );
      const dunk = async () => storage.get("serverError");
      await expect(dunk()).rejects.toThrow(
        "Error fetching serverError: 500 INTERNAL ERROR"
      );
    });

    it("works when posting and getting data again.", async () => {
      expect.hasAssertions();
      const path = "post/validPath";
      const storage = createPostableLedgerStorage("");
      await storage.set(path, value);
      const result = await storage.get(path);
      await expect(result).toEqual(value);
    });
  });
});
