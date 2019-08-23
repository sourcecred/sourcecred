// @flow

import deepFreeze from "deep-freeze";
import {Fetcher, type DiscourseFetchOptions} from "./fetch";
import base64url from "base64url";
import path from "path";
import fs from "fs-extra";

describe("plugins/discourse/fetch", () => {
  const options: DiscourseFetchOptions = deepFreeze({
    apiKey: "FAKE_KEY",
    apiUsername: "credbot",
    serverUrl: "https://sourcecred-test.discourse.group",
  });

  describe("snapshot testing", () => {
    async function snapshotFetch(
      url: string | Request | URL
    ): Promise<Response> {
      const snapshotDir = "src/plugins/discourse/snapshots";
      const filename = base64url(url);
      const file = path.join(snapshotDir, filename);
      if (await fs.exists(file)) {
        const contents = await fs.readFile(file);
        return new Response(contents, {status: 200});
      } else {
        throw new Error(`couldn't load snapshot for ${file}`);
      }
    }
    const snapshotFetcher = () => new Fetcher(options, snapshotFetch, 0);

    it("loads LatestTopicId from snapshot", async () => {
      const topicId = await snapshotFetcher().latestTopicId();
      expect(topicId).toMatchInlineSnapshot(`13`);
    });
    it("loads latest posts from snapshot", async () => {
      expect(await snapshotFetcher().latestPosts()).toMatchSnapshot();
    });
    it("loads a particular topic from snapshot", async () => {
      expect(await snapshotFetcher().topicWithPosts(11)).toMatchSnapshot();
    });
    it("loads a particular post from snapshot", async () => {
      expect(await snapshotFetcher().post(14)).toMatchSnapshot();
    });
    it("loads user likes from snapshot", async () => {
      expect(
        await snapshotFetcher().likesByUser("dl-proto", 0)
      ).toMatchSnapshot();
    });
  });

  describe("error handling", () => {
    const fakeFetch = (status: number) => (url: any) => {
      const resp = new Response("", {status, url});
      return Promise.resolve(resp);
    };
    const fetcherWithStatus = (status: number) =>
      new Fetcher(options, fakeFetch(status), 0);
    function expectError(name, f, status) {
      it(`${name} errors on ${String(status)}`, () => {
        const fetcher = fetcherWithStatus(status);
        expect.assertions(1);
        const result = f(fetcher);
        return result.catch((e) => expect(e.message).toMatch(String(status)));
      });
    }
    expectError("latestTopicId", (x) => x.latestTopicId(), 404);
    expectError("latestTopicId", (x) => x.latestTopicId(), 403);
    expectError("latestTopicId", (x) => x.latestTopicId(), 429);

    expectError("latestPosts", (x) => x.latestPosts(), 404);
    expectError("latestPosts", (x) => x.latestPosts(), 403);
    expectError("latestPosts", (x) => x.latestPosts(), 429);

    expectError("topic", (x) => x.topicWithPosts(14), 429);
    expectError("post", (x) => x.post(14), 429);

    function expectNull(name, f, status) {
      it(`${name} returns null on ${String(status)}`, async () => {
        const fetcher = fetcherWithStatus(status);
        const result = f(fetcher);
        expect(await result).toBe(null);
      });
    }

    expectNull("topic", (x) => x.topicWithPosts(14), 404);
    expectNull("topic", (x) => x.topicWithPosts(14), 403);
    expectNull("post", (x) => x.post(14), 404);
    expectNull("post", (x) => x.post(14), 403);
  });

  describe("fetch headers", () => {
    it("calls fetch with the right options and headers", async () => {
      let fetchOptions: ?RequestOptions;
      const fakeFetch = (url, _options) => {
        fetchOptions = _options;
        return Promise.resolve(new Response("", {status: 404}));
      };
      await new Fetcher(options, fakeFetch, 0).post(1337);
      if (fetchOptions == null) {
        throw new Error("fetchOptions == null");
      }
      expect(fetchOptions.method).toEqual("GET");
      expect(fetchOptions.headers["Api-Key"]).toEqual(options.apiKey);
      expect(fetchOptions.headers["Api-Username"]).toEqual(options.apiUsername);
      expect(fetchOptions.headers["Accept"]).toEqual("application/json");
    });
  });
});
