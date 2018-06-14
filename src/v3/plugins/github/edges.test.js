// @flow

import {NodeAddress, EdgeAddress, edgeToString} from "../../core/graph";
import {createEdge, fromRaw, toRaw} from "./edges";
import * as GE from "./edges";
import * as GN from "./nodes";

describe("plugins/github/edges", () => {
  const nodeExamples = {
    repo: () => ({
      type: GN.REPO_TYPE,
      owner: "sourcecred",
      name: "example-github",
    }),
    issue: () => ({
      type: GN.ISSUE_TYPE,
      repo: nodeExamples.repo(),
      number: "2",
    }),
    pull: () => ({type: GN.PULL_TYPE, repo: nodeExamples.repo(), number: "5"}),
    review: () => ({
      type: GN.REVIEW_TYPE,
      pull: nodeExamples.pull(),
      id: "100313899",
    }),
    issueComment: () => ({
      type: GN.COMMENT_TYPE,
      parent: nodeExamples.issue(),
      id: "373768703",
    }),
    pullComment: () => ({
      type: GN.COMMENT_TYPE,
      parent: nodeExamples.pull(),
      id: "396430464",
    }),
    reviewComment: () => ({
      type: GN.COMMENT_TYPE,
      parent: nodeExamples.review(),
      id: "171460198",
    }),
    user: () => ({type: GN.USERLIKE_TYPE, login: "decentralion"}),
  };

  const edgeExamples = {
    authors: () => ({
      type: GE.AUTHORS_TYPE,
      author: nodeExamples.user(),
      content: nodeExamples.pull(),
    }),
    mergedAs: () => ({
      type: GE.MERGED_AS_TYPE,
      pull: nodeExamples.pull(),
    }),
    hasParent: () => ({
      type: GE.HAS_PARENT_TYPE,
      child: nodeExamples.reviewComment(),
    }),
    references: () => ({
      type: GE.REFERENCES_TYPE,
      referrer: nodeExamples.issue(),
      referent: {type: GN.ISSUE_TYPE, repo: nodeExamples.repo(), number: "1"},
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
