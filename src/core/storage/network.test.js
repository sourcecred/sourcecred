// @flow

import {NetworkStorage} from "./network";

jest.mock("cross-fetch", () => ({
  // needed to utilize fetch as a default export.
  __esModule: true,
  default: (path) => {
    switch (path) {
      case "base/validPath":
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

describe("core/storage/network", () => {
  describe("NetworkStorage", () => {
    const value = new Uint8Array([1, 2]);
    it("returns a payload", async () => {
      expect.hasAssertions();

      const storage = new NetworkStorage("");
      const result = await storage.get("base/validPath");
      await expect(result).toEqual(value);
    });
    it("respects URL bases", async () => {
      expect.hasAssertions();
      const storage = new NetworkStorage("base");
      const thunk = async () => storage.get("base/validPath");
      await expect(thunk()).rejects.toThrow(
        "Error fetching base/validPath: 404 NOT FOUND"
      );
      const result = await storage.get("validPath");
      await expect(result).toEqual(value);
    });
    it("throws an error if the http response is not ok", async () => {
      expect.hasAssertions();
      const storage = new NetworkStorage("base");
      const thunk = async () => storage.get("invalidPath");
      await expect(thunk()).rejects.toThrow(
        "Error fetching invalidPath: 404 NOT FOUND"
      );
      const dunk = async () => storage.get("serverError");
      await expect(dunk()).rejects.toThrow(
        "Error fetching serverError: 500 INTERNAL ERROR"
      );
    });
  });
});
