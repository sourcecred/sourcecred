// @flow

import {
  parseLinks,
  linksToReferences,
  type DiscourseReference,
} from "./references";
import {snapshotFetcher} from "./mockSnapshotFetcher";

describe("plugins/discourse/references", () => {
  function spyError(): JestMockFn<[string], void> {
    return ((console.error: any): JestMockFn<any, void>);
  }
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    try {
      expect(console.error).not.toHaveBeenCalled();
    } finally {
      spyError().mockRestore();
    }
  });

  describe("parseLinks", () => {
    const serverUrl = "https://example.com";
    it("does not error on empty string", () => {
      expect(parseLinks("", serverUrl)).toEqual([]);
    });
    it("does not error on non-html", () => {
      expect(parseLinks("foo bar", serverUrl)).toEqual([]);
    });
    it("does not pick up raw urls", () => {
      expect(parseLinks("https://www.google.com", serverUrl)).toEqual([]);
    });
    it("picks up a (https://) hyperlink in href", () => {
      expect(
        parseLinks(`<a href="https://www.google.com">A Link</a>`, serverUrl)
      ).toEqual(["https://www.google.com"]);
    });
    it("picks up a (http://) hyperlink in href", () => {
      expect(
        parseLinks(`<a href="http://www.google.com">A Link</a>`, serverUrl)
      ).toEqual(["http://www.google.com"]);
    });
    it("doesn't pick up anchor hrefs", () => {
      expect(parseLinks(`<a href="#foo">A Link</a>`, serverUrl)).toEqual([]);
    });
    it("converts relative hrefs to full urls", () => {
      expect(
        parseLinks(`<a href="/u/decentralion">A Link</a>`, serverUrl)
      ).toEqual([`${serverUrl}/u/decentralion`]);
    });
    it("errors for a bad serverUrl", () => {
      expect(() =>
        parseLinks(`<a href="/u/decentralion">A Link</a>`, "foobar")
      ).toThrowError("Invalid server url");
    });
    it("strips trailing slashes in the serverUrl", () => {
      expect(
        parseLinks(`<a href="/u/decentralion">A Link</a>`, serverUrl + "/")
      ).toEqual([`${serverUrl}/u/decentralion`]);
    });
  });

  describe("linksToReferences", () => {
    it("works for http and https servers", () => {
      const hyperlinks = [
        "http://sourcecred-test.discourse.group/t/123-a-post-with-numbers-in-slug/20",
        "https://sourcecred-test.discourse.group/t/123-a-post-with-numbers-in-slug/20",
      ];
      expect(linksToReferences(hyperlinks)).toEqual([
        {
          type: "TOPIC",
          topicId: 20,
          serverUrl: "http://sourcecred-test.discourse.group",
        },
        {
          type: "TOPIC",
          topicId: 20,
          serverUrl: "https://sourcecred-test.discourse.group",
        },
      ]);
    });
    it("works for topics", () => {
      const hyperlinks = [
        "https://sourcecred-test.discourse.group/t/123-a-post-with-numbers-in-slug/20",
        "https://sourcecred-test.discourse.group/t/123-a-post-with-numbers-in-slug/20/",
        "https://sourcecred-test.discourse.group/t/123-a-post-with-numbers-in-slug/20?u=d11",
      ];
      const reference = {
        type: "TOPIC",
        topicId: 20,
        serverUrl: "https://sourcecred-test.discourse.group",
      };
      expect(linksToReferences(hyperlinks)).toEqual([
        reference,
        reference,
        reference,
      ]);
    });
    it("works for posts", () => {
      const hyperlinks = [
        "https://sourcecred-test.discourse.group/t/my-first-test-post/11/2?u=d11",
        "https://sourcecred-test.discourse.group/t/my-first-test-post/11/2/",
        "https://sourcecred-test.discourse.group/t/my-first-test-post/11/2",
      ];
      const reference = {
        type: "POST",
        topicId: 11,
        postIndex: 2,
        serverUrl: "https://sourcecred-test.discourse.group",
      };
      expect(linksToReferences(hyperlinks)).toEqual([
        reference,
        reference,
        reference,
      ]);
    });
    it("works for mentions", () => {
      const hyperlinks = ["https://sourcecred-test.discourse.group/u/d11"];
      const reference = {
        type: "USER",
        username: "d11",
        serverUrl: "https://sourcecred-test.discourse.group",
      };
      expect(linksToReferences(hyperlinks)).toEqual([reference]);
    });
    it("doesn't find bad or malformed references", () => {
      const hyperlinks = [
        // Not a reference to anything in particular.
        "https://sourcecred-test.discourse.group",
        // No https == no go. We can be more permissive if needed.
        "sourcecred-test.discourse.group/t/foo/120",
        // There's a space at the front.
        " https://sourcecred-test.discourse.group/t/foo/120",
        // unexpected trailing stuff
        "https://sourcecred-test.discourse.group/t/foo/120$$",
        // malformed URI.
        "https://foo.bar/incorrect%20encoding%20%93.htm",
      ];
      expect(linksToReferences(hyperlinks)).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        "URIError: URI malformed\nFor URL: https://foo.bar/incorrect%20encoding%20%93.htm"
      );
      expect(console.error).toHaveBeenCalledTimes(1);
      spyError().mockReset();
    });
    it("works on a snapshot corpus", () => {
      const hyperlinks = [
        "https://discourse.sourcecred.io/t/experiment-sourcecred-stack-lookup/287/4",
        "https://discourse.sourcecred.io/t/experiment-sourcecred-stack-lookup/287/4?u=decentralion",
        "https://talk.observablehq.com/t/having-some-trouble-with-d3-dragging/776",
        "https://talk.observablehq.com/t/package-integrity-and-yarn-lock-package-lock-json/2300/6",
        // This topic has non-ASCII characters in the topic name; seems like
        // (that particular discoures instance) filtered it out to leave a
        // neutral topic slug.
        "https://forums.eveonline.com/t/topic/195153",
        // Shouldn't necessarily get a reference, since @-references generate
        // links that do not have the /summary suffix.
        "https://forums.eveonline.com/u/dorian_neil/summary",
        "https://discourse.sourcecred.io/u/decentralion",
      ];
      const hyperlinkToReference = {};
      for (const hyperlink of hyperlinks) {
        hyperlinkToReference[hyperlink] = linksToReferences([hyperlink])[0];
      }
      expect(hyperlinkToReference).toMatchInlineSnapshot(`
        Object {
          "https://discourse.sourcecred.io/t/experiment-sourcecred-stack-lookup/287/4": Object {
            "postIndex": 4,
            "serverUrl": "https://discourse.sourcecred.io",
            "topicId": 287,
            "type": "POST",
          },
          "https://discourse.sourcecred.io/t/experiment-sourcecred-stack-lookup/287/4?u=decentralion": Object {
            "postIndex": 4,
            "serverUrl": "https://discourse.sourcecred.io",
            "topicId": 287,
            "type": "POST",
          },
          "https://discourse.sourcecred.io/u/decentralion": Object {
            "serverUrl": "https://discourse.sourcecred.io",
            "type": "USER",
            "username": "decentralion",
          },
          "https://forums.eveonline.com/t/topic/195153": Object {
            "serverUrl": "https://forums.eveonline.com",
            "topicId": 195153,
            "type": "TOPIC",
          },
          "https://forums.eveonline.com/u/dorian_neil/summary": undefined,
          "https://talk.observablehq.com/t/having-some-trouble-with-d3-dragging/776": Object {
            "serverUrl": "https://talk.observablehq.com",
            "topicId": 776,
            "type": "TOPIC",
          },
          "https://talk.observablehq.com/t/package-integrity-and-yarn-lock-package-lock-json/2300/6": Object {
            "postIndex": 6,
            "serverUrl": "https://talk.observablehq.com",
            "topicId": 2300,
            "type": "POST",
          },
        }
      `);
    });
  });

  describe("integration testing", () => {
    const serverUrl = "https://sourcecred-test.discourse.group";
    function linkIntegrationTest(
      hyperlink: string,
      expected: DiscourseReference
    ) {
      const link = `<a href=${hyperlink}></a>`;
      const parsed = parseLinks(link, serverUrl);
      const actual = linksToReferences(parsed);
      expect(actual).toEqual([expected]);
    }
    it("for an absolute mention", () => {
      linkIntegrationTest(`${serverUrl}/u/example`, {
        type: "USER",
        username: "example",
        serverUrl,
      });
    });
    it("for a relative mention", () => {
      linkIntegrationTest("/u/example", {
        type: "USER",
        username: "example",
        serverUrl,
      });
    });
    it("for an absolute topic", () => {
      linkIntegrationTest(`${serverUrl}/t/slug/103`, {
        type: "TOPIC",
        topicId: 103,
        serverUrl,
      });
    });
    it("for a relative topic", () => {
      linkIntegrationTest("/t/slug/103", {
        type: "TOPIC",
        topicId: 103,
        serverUrl,
      });
    });
    it("for an absolute post", () => {
      linkIntegrationTest(`${serverUrl}/t/slug/103/3`, {
        type: "POST",
        topicId: 103,
        postIndex: 3,
        serverUrl,
      });
    });
    it("for a relative post", () => {
      linkIntegrationTest("/t/slug/103/3", {
        type: "POST",
        topicId: 103,
        postIndex: 3,
        serverUrl,
      });
    });
    it("snapshots on a topic with references", async () => {
      const topic = await snapshotFetcher().topicWithPosts(21);
      if (topic == null) {
        throw new Error("Unable to find topic 21");
      }
      const serverUrl = "https://sourcecred-test.discourse.group";
      const post = topic.posts[0];
      const links = parseLinks(post.cooked, serverUrl);
      expect(links).toMatchInlineSnapshot(`
        Array [
          "https://sourcecred-test.discourse.group/u/dl-proto",
          "https://sourcecred-test.discourse.group/t/123-a-post-with-numbers-in-slug/20/",
          "https://sourcecred-test.discourse.group/t/my-first-test-post/11/4",
        ]
      `);
      // It should have a topic reference, post reference, and mention.
      // See: https://sourcecred-test.discourse.group/t/a-post-with-references/21
      const references = linksToReferences(links);
      expect(references).toMatchInlineSnapshot(`
        Array [
          Object {
            "serverUrl": "https://sourcecred-test.discourse.group",
            "type": "USER",
            "username": "dl-proto",
          },
          Object {
            "serverUrl": "https://sourcecred-test.discourse.group",
            "topicId": 20,
            "type": "TOPIC",
          },
          Object {
            "postIndex": 4,
            "serverUrl": "https://sourcecred-test.discourse.group",
            "topicId": 11,
            "type": "POST",
          },
        ]
      `);
    });
  });
});
