/**
 * @flow
 * @jest-environment jsdom
 */
import {createPostableStorage} from "./originStorage";

// Note: variables that meant to be used with jest's mocks must be prefixed
// with 'mock' in order to function.
const mockServerTempValue = new Map();

function mockJsdomShim(path: string, body: string) {
  return new Promise((res) => {
    const fileReader = new global.FileReader();
    fileReader.onload = () => {
      const buffer = fileReader.result;
      res({
        arrayBuffer: () => buffer,
        ok: true,
        status: 200,
        statusText: "OK",
      });
      mockServerTempValue.set(path, buffer);
    };
    fileReader.readAsArrayBuffer(body);
  });
}

jest.mock("cross-fetch", () => ({
  // needed to utilize fetch as a default export.
  __esModule: true,
  default: (path, options) => {
    if (options?.method === "POST") {
      return mockJsdomShim(path, options.body);
    }

    switch (path) {
      case "post/browser/validPath":
        return Promise.resolve({
          arrayBuffer: () => mockServerTempValue.get(path),
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

describe("core/storage/originStorage.browser", () => {
  describe("OriginStorage", () => {
    const value = new Uint8Array([1, 2]);

    it("works when posting and getting data again.", async () => {
      expect.hasAssertions();
      const path = "post/browser/validPath";
      const storage = createPostableStorage("");
      await storage.set(path, value);
      const result = await storage.get(path);
      await expect(result).toEqual(value);
    });
  });
});
