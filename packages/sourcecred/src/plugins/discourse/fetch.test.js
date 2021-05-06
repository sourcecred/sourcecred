// @flow

import {Fetcher} from "./fetch";
import {options, snapshotFetcher} from "./mockSnapshotFetcher";

describe("plugins/discourse/fetch", () => {
  describe("snapshot testing", () => {
    it("loads a particular topic from snapshot", async () => {
      expect(await snapshotFetcher().topicWithPosts(11)).toMatchSnapshot();
    });
    it("loads a topic with pagination from snapshot", async () => {
      expect(await snapshotFetcher().topicWithPosts(26)).toMatchSnapshot();
    });
    it("loads user likes from snapshot", async () => {
      expect(
        await snapshotFetcher().likesByUser("dl-proto", 0)
      ).toMatchSnapshot();
    });
    it("loads user data from snapshot dl-proto", async () => {
      expect(await snapshotFetcher().getUserData("dl-proto")).toMatchSnapshot();
    });
    it("loads topic IDs that are category definition topics", async () => {
      expect(
        await snapshotFetcher().categoryDefinitionTopicIds()
      ).toMatchSnapshot();
    });

    it("loads topics ordered by bumped_at since a given timestamp", async () => {
      const topicsBumpedSince = await snapshotFetcher().topicsBumpedSince(0);
      expect(topicsBumpedSince).toMatchSnapshot();
      // This checks we have pagination in our snapshot.
      expect(topicsBumpedSince.length).toBeGreaterThan(30);
    });
  });

  describe("error handling", () => {
    const fakeFetch = (status: number) => (url: any) => {
      const resp = new Response("", {status, url});
      return Promise.resolve(resp);
    };
    const fetcherWithStatus = (status: number) =>
      new Fetcher(options, fakeFetch(status), 0);

    it("retries on 520", async () => {
      const mockFetch = jest.fn();
      mockFetch
        .mockReturnValueOnce(
          Promise.resolve(new Response("", {status: 520, url: "/something"}))
        )
        .mockReturnValueOnce(
          Promise.resolve(new Response("", {status: 520, url: "/something"}))
        )
        .mockReturnValue(
          Promise.resolve(new Response("", {status: 200, url: "/something"}))
        );

      const fetcher = new Fetcher(options, mockFetch, 0);
      const response = await fetcher._fetch("/something");

      expect(response.status).toEqual(200);
      expect(mockFetch.mock.calls.length).toEqual(3);
    });

    it("errors after repeated 520 errors", async () => {
      const mockFetch = jest.fn();
      mockFetch.mockReturnValue(
        Promise.resolve(new Response("", {status: 520, url: "/something"}))
      );
      const fetcher = new Fetcher(options, mockFetch, 0);
      const response = fetcher._fetch("/something");
      await expect(response).rejects.toThrow("repeated 520 errors");
    });

    function expectError(name, f, status) {
      it(`${name} errors on ${String(status)}`, () => {
        const fetcher = fetcherWithStatus(status);
        expect.assertions(1);
        const result = f(fetcher);
        return result.catch((e) => expect(e.message).toMatch(String(status)));
      });
    }

    expectError("topicWithPosts", (x) => x.topicWithPosts(14), 429);
    expectError("topicsBumpedSince", (x) => x.topicsBumpedSince(0), 429);
    expectError(
      "categoryDefinitionTopicIds",
      (x) => x.categoryDefinitionTopicIds(),
      429
    );
    expectError("likesByUser", (x) => x.likesByUser("dl-proto", 0), 403);
    expectError("likesByUser", (x) => x.likesByUser("dl-proto", 0), 429);

    function expectNull(name, f, status) {
      it(`${name} returns null on ${String(status)}`, async () => {
        const fetcher = fetcherWithStatus(status);
        const result = f(fetcher);
        expect(await result).toBe(null);
      });
    }

    expectNull("topicWithPosts", (x) => x.topicWithPosts(14), 404);
    expectNull("topicWithPosts", (x) => x.topicWithPosts(14), 403);
  });

  describe("fetch headers", () => {
    it("calls fetch with the right options and headers", async () => {
      let fetchOptions: ?RequestOptions;
      const fakeFetch = (url, _options) => {
        fetchOptions = _options;
        return Promise.resolve(new Response("", {status: 404}));
      };
      await new Fetcher(options, fakeFetch, 0).topicWithPosts(1337);
      if (fetchOptions == null) {
        throw new Error("fetchOptions == null");
      }
      expect(fetchOptions.method).toEqual("GET");
      expect(fetchOptions.headers["Accept"]).toEqual("application/json");
    });
  });
});
