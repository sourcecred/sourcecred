// @flow

import {NodeAddress} from "../../core/graph";
import * as GN from "./nodes";
import {fromRaw, toRaw, type UserlikeAddress, loginAddress} from "./nodes";

describe("plugins/github/nodes", () => {
  const repo = (): GN.RepoAddress => ({
    type: GN.REPO_TYPE,
    owner: "sourcecred",
    name: "example-github",
  });
  const issue = (): GN.IssueAddress => ({
    type: GN.ISSUE_TYPE,
    repo: repo(),
    number: "2",
  });
  const pull = (): GN.PullAddress => ({
    type: GN.PULL_TYPE,
    repo: repo(),
    number: "5",
  });
  const review = (): GN.ReviewAddress => ({
    type: GN.REVIEW_TYPE,
    pull: pull(),
    id: "100313899",
  });
  const issueComment = (): GN.CommentAddress => ({
    type: GN.COMMENT_TYPE,
    parent: issue(),
    id: "373768703",
  });
  const pullComment = (): GN.CommentAddress => ({
    type: GN.COMMENT_TYPE,
    parent: pull(),
    id: "396430464",
  });
  const reviewComment = (): GN.CommentAddress => ({
    type: GN.COMMENT_TYPE,
    parent: review(),
    id: "171460198",
  });
  const user = (): GN.UserlikeAddress => ({
    type: GN.USERLIKE_TYPE,
    subtype: "USER",
    login: "decentralion",
  });
  const commit = (): GN.CommitAddress => ({
    type: GN.COMMIT_TYPE,
    id: "12345",
  });

  const examples = {
    repo,
    issue,
    pull,
    review,
    issueComment,
    pullComment,
    reviewComment,
    user,
    commit,
  };

  // Incorrect types should be caught statically, either due to being
  // totally invalid...
  const _unused_badRepo: GN.RepoAddress = {
    // $FlowExpectedError[incompatible-type]
    type: "REPOSITORY",
    owner: "foo",
    name: "bar",
  };
  // ...or due to being annotated with the type of a distinct structured
  // address:
  // $FlowExpectedError[incompatible-type]
  const _unused_badIssue: GN.IssueAddress = {...pull()};

  describe("`fromRaw` after `toRaw` is identity", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        expect(fromRaw(toRaw(instance))).toEqual(instance);
      });
    });
  });

  describe("`toRaw` after `fromRaw` is identity", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        const raw = toRaw(instance);
        expect(toRaw(fromRaw(raw))).toEqual(raw);
      });
    });
  });

  describe("snapshots as expected:", () => {
    Object.keys(examples).forEach((example) => {
      it(example, () => {
        const instance = examples[example]();
        const raw = NodeAddress.toParts(toRaw(instance));
        expect({address: raw, structured: instance}).toMatchSnapshot();
      });
    });
  });

  describe("errors on", () => {
    describe("fromRaw(...) with", () => {
      function expectBadAddress(name: string, parts: $ReadOnlyArray<string>) {
        it(name, () => {
          const address = NodeAddress.fromParts([
            "sourcecred",
            "github",
            ...parts,
          ]);
          // $FlowExpectedError[incompatible-call]
          expect(() => fromRaw(address)).toThrow("Bad address");
        });
      }
      function checkBadCases(
        partses: $ReadOnlyArray<{|
          +name: string,
          +parts: $ReadOnlyArray<string>,
        |}>
      ) {
        let partsAccumulator = [];
        for (const {name, parts} of partses) {
          const theseParts = [...partsAccumulator, ...parts];
          expectBadAddress(name, theseParts);
          partsAccumulator = theseParts;
        }
      }
      it("undefined", () => {
        // $FlowExpectedError[incompatible-call]
        expect(() => fromRaw(undefined)).toThrow("undefined");
      });
      it("null", () => {
        // $FlowExpectedError[incompatible-call]
        expect(() => fromRaw(null)).toThrow("null");
      });
      it("with bad prefix", () => {
        // $FlowExpectedError[incompatible-call]
        expect(() => fromRaw(NodeAddress.fromParts(["foo"]))).toThrow(
          "Bad address"
        );
      });
      expectBadAddress("no kind", []);
      describe("repository with", () => {
        checkBadCases([
          {name: "no owner", parts: [GN.REPO_TYPE]},
          {name: "no name", parts: ["owner"]},
          {name: "extra parts", parts: ["name", "foo"]},
        ]);
      });
      describe("issue with", () => {
        checkBadCases([
          {name: "no owner", parts: [GN.ISSUE_TYPE]},
          {name: "no name", parts: ["owner"]},
          {name: "no number", parts: ["name"]},
          {name: "extra parts", parts: ["123", "foo"]},
        ]);
      });
      describe("pull request with", () => {
        checkBadCases([
          {name: "no owner", parts: [GN.PULL_TYPE]},
          {name: "no name", parts: ["owner"]},
          {name: "no number", parts: ["name"]},
          {name: "extra parts", parts: ["123", "foo"]},
        ]);
      });
      describe("pull request review with", () => {
        checkBadCases([
          {name: "no owner", parts: [GN.REVIEW_TYPE]},
          {name: "no name", parts: ["owner"]},
          {name: "no number", parts: ["name"]},
          {name: "no id", parts: ["123"]},
          {name: "extra parts", parts: ["987", "foo"]},
        ]);
      });
      describe("comment", () => {
        expectBadAddress("with no subkind", [GN.COMMENT_TYPE]);
        expectBadAddress("with bad subkind", [GN.COMMENT_TYPE, "ICE_CREAM"]);
        describe("on issue with", () => {
          checkBadCases([
            {name: "no owner", parts: [GN.COMMENT_TYPE, GN.ISSUE_TYPE]},
            {name: "no name", parts: ["owner"]},
            {name: "no number", parts: ["name"]},
            {name: "no id", parts: ["123"]},
            {name: "extra parts", parts: ["987", "foo"]},
          ]);
        });
        describe("on pull request with", () => {
          checkBadCases([
            {name: "no owner", parts: [GN.COMMENT_TYPE, GN.PULL_TYPE]},
            {name: "no name", parts: ["owner"]},
            {name: "no number", parts: ["name"]},
            {name: "no id", parts: ["123"]},
            {name: "extra parts", parts: ["987", "foo"]},
          ]);
        });
        describe("on pull request review with", () => {
          checkBadCases([
            {name: "no owner", parts: [GN.COMMENT_TYPE, GN.REVIEW_TYPE]},
            {name: "no name", parts: ["owner"]},
            {name: "no number", parts: ["name"]},
            {name: "no review id", parts: ["123"]},
            {name: "no comment id", parts: ["987"]},
            {name: "extra parts", parts: ["654", "foo"]},
          ]);
        });
      });
      describe("userlike", () => {
        checkBadCases([
          {name: "no subtype", parts: [GN.USERLIKE_TYPE]},
          {name: "bad subtype", parts: [GN.USERLIKE_TYPE, "FOO"]},
          {name: "no login", parts: [GN.USERLIKE_TYPE, GN.USER_SUBTYPE]},
          {
            name: "extra parts",
            parts: [GN.USERLIKE_TYPE, GN.USER_SUBTYPE, "decentra", "lion"],
          },
        ]);
      });
    });

    describe("toRaw(...) with", () => {
      it("null", () => {
        // $FlowExpectedError[incompatible-call]
        expect(() => toRaw(null)).toThrow("null");
      });
      it("undefined", () => {
        // $FlowExpectedError[incompatible-call]
        expect(() => toRaw(undefined)).toThrow("undefined");
      });
      it("bad type", () => {
        // $FlowExpectedError[incompatible-call]
        expect(() => toRaw({type: "ICE_CREAM"})).toThrow("Unexpected type");
      });
      it("bad comment type", () => {
        expect(() => {
          // $FlowExpectedError[incompatible-call]
          // $FlowExpectedError[prop-missing]
          toRaw({type: "COMMENT", parent: {type: "ICE_CREAM"}});
        }).toThrow("Bad comment parent type");
      });
    });
  });

  describe("loginAddress", () => {
    it("works for a regular user", () => {
      const username = "foo";
      const structured: UserlikeAddress = {
        type: "USERLIKE",
        subtype: "USER",
        login: username,
      };
      const actual = loginAddress(username);
      const expected = toRaw(structured);
      expect(actual).toEqual(expected);
    });
    it("works for a bot", () => {
      const username = "credbot";
      const structured: UserlikeAddress = {
        type: "USERLIKE",
        subtype: "BOT",
        login: username,
      };
      const actual = loginAddress(username);
      const expected = toRaw(structured);
      expect(actual).toEqual(expected);
    });
  });
});
