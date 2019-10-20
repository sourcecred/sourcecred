// @flow

import {parseLinks, linksToReferences} from "./references";

describe("plugins/discourse/references", () => {
  describe("parseLinks", () => {
    it("does not error on empty string", () => {
      expect(parseLinks("")).toEqual([]);
    });
    it("does not error on non-html", () => {
      expect(parseLinks("foo bar")).toEqual([]);
    });
    it("does not pick up raw urls", () => {
      expect(parseLinks("https://www.google.com")).toEqual([]);
    });
    it("picks up a (https://) hyperlink in href", () => {
      expect(parseLinks(`<a href="https://www.google.com">A Link</a>`)).toEqual(
        ["https://www.google.com"]
      );
    });
    it("picks up a (http://) hyperlink in href", () => {
      expect(parseLinks(`<a href="http://www.google.com">A Link</a>`)).toEqual([
        "http://www.google.com",
      ]);
    });
    it("doesn't pick up anchor hrefs", () => {
      expect(parseLinks(`<a href="#foo">A Link</a>`)).toEqual([]);
    });
  });

  describe("linksToReferences", () => {
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
      ];
      expect(linksToReferences(hyperlinks)).toEqual([]);
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
});
