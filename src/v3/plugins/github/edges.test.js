// @flow

import {NodeAddress, EdgeAddress, edgeToString} from "../../core/graph";
import {createEdge, fromRaw, toRaw} from "./edges";

describe("plugins/github/edges", () => {
  const nodeExamples = {
    repo: () => ({
      type: "REPO",
      owner: "sourcecred",
      name: "example-github",
    }),
    issue: () => ({type: "ISSUE", repo: nodeExamples.repo(), number: "2"}),
    pull: () => ({type: "PULL", repo: nodeExamples.repo(), number: "5"}),
    review: () => ({
      type: "REVIEW",
      pull: nodeExamples.pull(),
      id: "100313899",
    }),
    issueComment: () => ({
      type: "COMMENT",
      parent: nodeExamples.issue(),
      id: "373768703",
    }),
    pullComment: () => ({
      type: "COMMENT",
      parent: nodeExamples.pull(),
      id: "396430464",
    }),
    reviewComment: () => ({
      type: "COMMENT",
      parent: nodeExamples.review(),
      id: "171460198",
    }),
    user: () => ({type: "USERLIKE", login: "decentralion"}),
  };

  const edgeExamples = {
    authors: () => ({
      type: "AUTHORS",
      author: nodeExamples.user(),
      content: nodeExamples.pull(),
    }),
    mergedAs: () => ({
      type: "MERGED_AS",
      pull: nodeExamples.pull(),
    }),
    hasParent: () => ({
      type: "HAS_PARENT",
      child: nodeExamples.reviewComment(),
    }),
    references: () => ({
      type: "REFERENCES",
      referrer: nodeExamples.issue(),
      referent: {type: "ISSUE", repo: nodeExamples.repo(), number: "1"},
    }),
  };

  describe("createEdge", () => {
    it("works for authors edges", () => {
      expect(
        edgeToString(
          createEdge.authors(nodeExamples.user(), nodeExamples.issue())
        )
      ).toMatchSnapshot();
    });
    it("works for merged-as edges", () => {
      const commitAddress = NodeAddress.fromParts(["git", "commit", "123"]);
      expect(
        edgeToString(createEdge.mergedAs(nodeExamples.pull(), commitAddress))
      ).toMatchSnapshot();
    });
    it("works for has-parent edges", () => {
      expect(
        edgeToString(
          createEdge.hasParent(
            nodeExamples.reviewComment(),
            nodeExamples.review()
          )
        )
      ).toMatchSnapshot();
    });
    it("works for reference edges", () => {
      expect(
        edgeToString(
          createEdge.references(nodeExamples.issue(), nodeExamples.pull())
        )
      ).toMatchSnapshot();
    });
  });

  describe("`fromRaw` after `toRaw` is identity", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(example, () => {
        const instance = edgeExamples[example]();
        expect(fromRaw(toRaw(instance))).toEqual(instance);
      });
    });
  });

  describe("`toRaw` after `fromRaw` is identity", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(example, () => {
        const instance = edgeExamples[example]();
        const raw = toRaw(instance);
        expect(toRaw(fromRaw(raw))).toEqual(raw);
      });
    });
  });

  describe("snapshots as expected:", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(example, () => {
        const instance = edgeExamples[example]();
        const raw = EdgeAddress.toParts(toRaw(instance));
        expect({address: raw, structured: instance}).toMatchSnapshot();
      });
    });
  });
});
