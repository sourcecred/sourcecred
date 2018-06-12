// @flow

import {NodeAddress} from "../../core/graph";
import {fromRaw, toRaw} from "./nodes";

describe("plugins/github/nodes", () => {
  const repo = () => ({
    type: "REPO",
    owner: "sourcecred",
    name: "example-github",
  });
  const issue = () => ({type: "ISSUE", repo: repo(), number: "2"});
  const pull = () => ({type: "PULL", repo: repo(), number: "5"});
  const review = () => ({type: "REVIEW", pull: pull(), fragment: "100313899"});
  const issueComment = () => ({
    type: "COMMENT",
    parent: issue(),
    fragment: "373768703",
  });
  const pullComment = () => ({
    type: "COMMENT",
    parent: pull(),
    fragment: "396430464",
  });
  const reviewComment = () => ({
    type: "COMMENT",
    parent: review(),
    fragment: "171460198",
  });
  const user = () => ({type: "USERLIKE", login: "decentralion"});
  const examples = {
    repo,
    issue,
    pull,
    review,
    issueComment,
    pullComment,
    reviewComment,
    user,
  };

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
          // $ExpectFlowError
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
        // $ExpectFlowError
        expect(() => fromRaw(undefined)).toThrow("undefined");
      });
      it("null", () => {
        // $ExpectFlowError
        expect(() => fromRaw(null)).toThrow("null");
      });
      it("with bad prefix", () => {
        // $ExpectFlowError
        expect(() => fromRaw(NodeAddress.fromParts(["foo"]))).toThrow(
          "Bad address"
        );
      });
      expectBadAddress("no kind", []);
      describe("repository with", () => {
        checkBadCases([
          {name: "no owner", parts: ["repo"]},
          {name: "no name", parts: ["owner"]},
          {name: "extra parts", parts: ["name", "foo"]},
        ]);
      });
      describe("issue with", () => {
        checkBadCases([
          {name: "no owner", parts: ["issue"]},
          {name: "no name", parts: ["owner"]},
          {name: "no number", parts: ["name"]},
          {name: "extra parts", parts: ["123", "foo"]},
        ]);
      });
      describe("pull request with", () => {
        checkBadCases([
          {name: "no owner", parts: ["pull"]},
          {name: "no name", parts: ["owner"]},
          {name: "no number", parts: ["name"]},
          {name: "extra parts", parts: ["123", "foo"]},
        ]);
      });
      describe("pull request review with", () => {
        checkBadCases([
          {name: "no owner", parts: ["review"]},
          {name: "no name", parts: ["owner"]},
          {name: "no number", parts: ["name"]},
          {name: "no fragment", parts: ["123"]},
          {name: "extra parts", parts: ["987", "foo"]},
        ]);
      });
      describe("comment", () => {
        expectBadAddress("with no subkind", ["comment"]);
        expectBadAddress("with bad subkind", ["comment", "icecream"]);
        describe("on issue with", () => {
          checkBadCases([
            {name: "no owner", parts: ["comment", "issue"]},
            {name: "no name", parts: ["owner"]},
            {name: "no number", parts: ["name"]},
            {name: "no fragment", parts: ["123"]},
            {name: "extra parts", parts: ["987", "foo"]},
          ]);
        });
        describe("on pull request with", () => {
          checkBadCases([
            {name: "no owner", parts: ["comment", "pull"]},
            {name: "no name", parts: ["owner"]},
            {name: "no number", parts: ["name"]},
            {name: "no fragment", parts: ["123"]},
            {name: "extra parts", parts: ["987", "foo"]},
          ]);
        });
        describe("on pull request review with", () => {
          checkBadCases([
            {name: "no owner", parts: ["comment", "review"]},
            {name: "no name", parts: ["owner"]},
            {name: "no number", parts: ["name"]},
            {name: "no review fragment", parts: ["123"]},
            {name: "no comment fragment", parts: ["987"]},
            {name: "extra parts", parts: ["654", "foo"]},
          ]);
        });
      });
      describe("userlike", () => {
        checkBadCases([
          {name: "no login", parts: ["userlike"]},
          {name: "extra parts", parts: ["decentra", "lion"]},
        ]);
      });
    });

    describe("toRaw(...) with", () => {
      it("null", () => {
        // $ExpectFlowError
        expect(() => toRaw(null)).toThrow("null");
      });
      it("undefined", () => {
        // $ExpectFlowError
        expect(() => toRaw(undefined)).toThrow("undefined");
      });
      it("bad type", () => {
        // $ExpectFlowError
        expect(() => toRaw({type: "ICE_CREAM"})).toThrow("Unexpected type");
      });
      it("bad comment type", () => {
        expect(() => {
          // $ExpectFlowError
          toRaw({type: "COMMENT", parent: {type: "ICE_CREAM"}});
        }).toThrow("Bad comment parent type");
      });
    });
  });
});
