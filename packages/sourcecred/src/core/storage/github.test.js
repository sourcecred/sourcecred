// @flow

import {GithubStorage} from "./github";
import {encode} from "./textEncoding";
import {encode as base64Encode} from "base-64";

const mockContent = base64Encode("");
const owner = "sourcecred";
const name = "sourcecred";
const oid = "55adb2945959a87de3a492ce950473a30449e54e";
const ENDPOINT = "https://api.github.com";

jest.mock("cross-fetch", () => ({
  // needed to utilize fetch as a default export.
  __esModule: true,
  default: (path) => {
    switch (path) {
      case `${ENDPOINT}/graphql`:
        return Promise.resolve({
          json: () => ({
            data: {
              repository: {
                object: {
                  oid,
                },
              },
            },
          }),
          ok: true,
          status: 200,
          statusText: "OK",
        });
      case `${ENDPOINT}/repos/${owner}/${name}/git/blobs/${oid}`:
        return Promise.resolve({
          arrayBuffer: () => new ArrayBuffer(0),
          json: () => ({
            content: mockContent,
          }),
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

describe("core/storage/github", () => {
  describe("GithubStorage", () => {
    // const value = new Uint8Array([1, 2]);
    it("make sure everything is working.", async () => {
      // expect.hasAssertions();
      const storage = new GithubStorage({
        apiToken: `GithubToken`,
        repo: `${owner}/${name}`,
        branch: "string",
      });

      const result = await storage.get("data/ledger.json");
      await expect(result).toEqual(encode(""));
    });
    // it("throws on upward traversal when the base is a url", async () => {
    //   expect.hasAssertions();
    //   const storage = new NetworkStorage("https://sourcecred.io/base/");
    //   const thunk = async () => storage.get("../validPath");
    //   await expect(thunk()).rejects.toThrow("Path traversal is not allowed");
    // });
    // it("throws an error if the http response is not ok", async () => {
    //   expect.hasAssertions();
    //   const storage = new NetworkStorage("https://sourcecred.io/base/");
    //   const thunk = async () => storage.get("invalidPath");
    //   await expect(thunk()).rejects.toThrow(
    //     "Error fetching invalidPath: 404 NOT FOUND"
    //   );
    //   const dunk = async () => storage.get("serverError");
    //   await expect(dunk()).rejects.toThrow(
    //     "Error fetching serverError: 500 INTERNAL ERROR"
    //   );
    // });
  });
});
