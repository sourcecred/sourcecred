// @flow

import {type EdgeAddressT, edgeToParts} from "../../core/graph";
import {createEdge, fromRaw, toRaw} from "./edges";
import * as GE from "./edges";
import * as GN from "./nodes";

describe("plugins/git/edges", () => {
  const nodeExamples = {
    commit: (): GN.CommitAddress => ({
      type: GN.COMMIT_TYPE,
      hash: "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f",
    }),
    parentCommit: (): GN.CommitAddress => ({
      type: GN.COMMIT_TYPE,
      hash: "69c5aad50eec8f2a0a07c988c3b283a6490eb45b",
    }),
  };

  const edgeExamples = {
    hasParent: () =>
      createEdge.hasParent(
        nodeExamples.commit(),
        nodeExamples.parentCommit(),
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
