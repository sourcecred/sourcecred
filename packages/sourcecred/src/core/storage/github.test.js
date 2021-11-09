// @flow

import {GithubStorage, WritableGithubStorage} from "./github";
import {encode} from "./textEncoding";
import {encode as base64Encode} from "base-64";

const mockContent = base64Encode("");
const mockOwner = "sourcecred";
const mockName = "sourcecred";
const mockBranch = "random-mockName";
const mockOid = "55adb2945959a87de3a492ce950473a30449e54e";
const mockEndpoint = "https://api.github.com";
const mockRepoEndpoint = `${mockEndpoint}/repos/${mockOwner}/${mockName}`;

// Note: variables that meant to be used with jest's mocks must be prefixed
// with 'mock' in order to for tests to work properly.
let mockServerTempValue;

function mock200ResponseWithJson(object: any) {
  return Promise.resolve({
    json: async () => object,
    ok: true,
    status: 200,
    statusText: "OK",
  });
}

jest.mock("cross-fetch", () => {
  return {
    // needed to utilize fetch as a default export.
    __esModule: true,
    default: (path, options) => {
      switch (path) {
        case `${mockEndpoint}/graphql`:
          return Promise.resolve({
            json: () => ({
              data: {
                repository: {
                  object: {
                    oid: mockOid,
                  },
                },
              },
            }),
            ok: true,
            status: 200,
            statusText: "OK",
          });
        case `${mockEndpoint}/repos/${mockOwner}/${mockName}/git/blobs/${mockOid}`:
          return mock200ResponseWithJson({
            content: mockServerTempValue ?? mockContent,
          });
        case `${mockRepoEndpoint}/git/ref/heads/${mockBranch}`:
          return mock200ResponseWithJson({
            object: {
              sha: "sodifnoweinfw",
            },
          });
        case `${mockRepoEndpoint}/git/blobs`:
          mockServerTempValue = JSON.parse(options.body).content;
          return mock200ResponseWithJson({
            sha: "sodifnoweinfw",
          });
        case `${mockRepoEndpoint}/git/trees`:
          return mock200ResponseWithJson({
            sha: "sodifnoweinfw",
          });
        case `${mockRepoEndpoint}/git/commits`:
          return mock200ResponseWithJson({
            sha: "sodifnoweinfw",
          });
        case `${mockRepoEndpoint}/git/refs/heads/${mockBranch}`:
          return Promise.resolve({
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
  };
});

describe("core/storage/github", () => {
  describe("GithubStorage", () => {
    it("works when using GitHubStorage to load content", async () => {
      expect.hasAssertions();
      const storage = new GithubStorage({
        apiToken: `GithubToken`,
        repo: `${mockOwner}/${mockName}`,
        branch: mockBranch,
      });

      const result = await storage.get("data/ledger.json");
      await expect(result).toEqual(encode(""));
    });
    it("works when using WritableGitHubStorage to post new content", async () => {
      expect.hasAssertions();
      const storage = new WritableGithubStorage({
        apiToken: `GithubToken`,
        repo: `${mockOwner}/${mockName}`,
        branch: mockBranch,
      });

      const path = "data/file.json";
      const value = "hello";
      const encodedValue = encode(value);
      await storage.set(path, encodedValue, "update text");

      const result = await storage.get(path);
      await expect(decode(result)).toEqual(value);
    });
  });
});
