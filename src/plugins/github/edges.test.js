// @flow

import {type EdgeAddressT, edgeToParts} from "../../core/graph";
import {createEdge, fromRaw, toRaw} from "./edges";
import * as GE from "./edges";
import * as GN from "./nodes";
import {COMMIT_TYPE} from "../git/nodes";
import {ReactionContent$Values as Reactions} from "./graphqlTypes";

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
    user: () => ({
      type: GN.USERLIKE_TYPE,
      subtype: "USER",
      login: "decentralion",
    }),
  };

  const edgeExamples = {
    authors: () =>
      createEdge.authors(nodeExamples.user(), nodeExamples.issue(), 102),
    mergedAs: () => {
      const commit = {type: COMMIT_TYPE, id: "123"};
      return createEdge.mergedAs(nodeExamples.pull(), commit, 102);
    },
    hasParent: () =>
      createEdge.hasParent(
        nodeExamples.reviewComment(),
        nodeExamples.review(),
        102
      ),
    references: () =>
      createEdge.references(nodeExamples.issue(), nodeExamples.pull(), 102),
    reactsHeart: () =>
      createEdge.reacts(
        Reactions.HEART,
        nodeExamples.user(),
        nodeExamples.pull(),
        102
      ),
    reactsThumbsUp: () =>
      createEdge.reacts(
        Reactions.THUMBS_UP,
        nodeExamples.user(),
        nodeExamples.issue(),
        102
      ),
    reactsHooray: () =>
      createEdge.reacts(
        Reactions.HOORAY,
        nodeExamples.user(),
        nodeExamples.issueComment(),
        102
      ),
    reactsRocket: () =>
      createEdge.reacts(
        Reactions.ROCKET,
        nodeExamples.user(),
        nodeExamples.pullComment(),
        102
      ),
  };

  describe("createEdge", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(`works for ${JSON.stringify(example)}`, () => {
        const instance = edgeExamples[example]();
        expect(edgeToParts(instance)).toMatchSnapshot();
      });
    });
  });

  describe("`toRaw` after `fromRaw` is identity", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(example, () => {
        const baseAddress: EdgeAddressT = edgeExamples[example]().address;
        const instance: GE.RawAddress = (baseAddress: any);
        expect(toRaw(fromRaw(instance))).toEqual(instance);
      });
    });
  });

  describe("`fromRaw` after `toRaw` is identity", () => {
    Object.keys(edgeExamples).forEach((example) => {
      it(example, () => {
        const baseAddress: EdgeAddressT = edgeExamples[example]().address;
        const instance: GE.RawAddress = (baseAddress: any);
        const structured: GE.StructuredAddress = fromRaw(instance);
        expect(fromRaw(toRaw(structured))).toEqual(structured);
      });
    });
  });
});
