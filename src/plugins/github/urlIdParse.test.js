// @flow

import {
  issueCommentUrlToId,
  pullCommentUrlToId,
  reviewCommentUrlToId,
  reviewUrlToId,
} from "./urlIdParse";

describe("plugins/github/urlIdParse", () => {
  const issueComment =
    "https://github.com/example-owner/exa_mple-rep.o0/issues/350#issuecomment-394939349";
  const pullComment =
    "https://github.com/example-owner/exa_mple-rep.o0/pull/363#issuecomment-395836900";
  const reviewComment =
    "https://github.com/example-owner/exa_mple-rep.o0/pull/380#discussion_r194816899";
  const review =
    "https://github.com/example-owner/exa_mple-rep.o0/pull/383#pullrequestreview-128199239";

  describe("works correctly", () => {
    it("for issueComment", () => {
      expect(issueCommentUrlToId(issueComment)).toEqual("394939349");
    });
    it("for pullComment", () => {
      expect(pullCommentUrlToId(pullComment)).toEqual("395836900");
    });
    it("for reviewComment", () => {
      expect(reviewCommentUrlToId(reviewComment)).toEqual("194816899");
    });
    it("for review", () => {
      expect(reviewUrlToId(review)).toEqual("128199239");
    });
  });
  describe("errors on", () => {
    const issueCommentNamed = {instance: issueComment, name: "issue comment"};
    const reviewCommentNamed = {
      instance: reviewComment,
      name: "review comment",
    };
    const pullCommentNamed = {instance: pullComment, name: "pull comment"};
    const reviewNamed = {instance: review, name: "review"};
    const withWrongTypes = [
      {
        f: issueCommentUrlToId,
        instances: [pullCommentNamed, reviewCommentNamed, reviewNamed],
      },
      {
        f: pullCommentUrlToId,
        instances: [issueCommentNamed, reviewCommentNamed, reviewNamed],
      },
      {
        f: reviewCommentUrlToId,
        instances: [pullCommentNamed, issueCommentNamed, reviewNamed],
      },
      {
        f: reviewUrlToId,
        instances: [pullCommentNamed, issueCommentNamed, reviewCommentNamed],
      },
    ];
    const nullNamed = {instance: null, name: "null"};
    const undefinedNamed = {instance: undefined, name: "undefined"};
    const nonsenseNamed = {instance: "nonsense", name: "nonsense"};
    const garbage = [nullNamed, undefinedNamed, nonsenseNamed];

    withWrongTypes.forEach(({f, instances}) => {
      describe(f.name, () => {
        const examples = [...instances, ...garbage];
        examples.forEach(({instance, name}) => {
          it(`recieving ${name}`, () => {
            // $FlowExpectedError[incompatible-call]
            expect(() => f(instance)).toThrow("Error parsing");
          });
        });
      });
    });
  });
});
