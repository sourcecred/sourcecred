// @flow

import stringify from "json-stable-stringify";
import {NodeAddress, EdgeAddress} from "../core/graph";
import {toJSON, fromJSON, defaultWeights, copy} from "./weights";

describe("analysis/weights", () => {
  it("copy makes a copy", () => {
    const w = defaultWeights();
    const w1 = copy(w);
    w1.nodeWeights.set(NodeAddress.empty, 33);
    w1.edgeWeights.set(EdgeAddress.empty, {forwards: 34, backwards: 39});
    w1.nodeWeights.set(NodeAddress.empty, 35);
    expect(w1).not.toEqual(w);
    expect(w1.nodeWeights).not.toEqual(w.nodeWeights);
    expect(w1.edgeWeights).not.toEqual(w.edgeWeights);
    expect(w1.nodeWeights).not.toEqual(w.nodeWeights);
  });
  describe("toJSON/fromJSON", () => {
    it("works for the default weights", () => {
      const weights = defaultWeights();
      const json = toJSON(weights);
      const jsonString = stringify(json, {space: 4});
      expect(jsonString).toMatchInlineSnapshot(`
        "[
            {
                \\"type\\": \\"sourcecred/weights\\",
                \\"version\\": \\"0.2.0\\"
            },
            {
                \\"edgeWeights\\": {
                },
                \\"nodeWeights\\": {
                }
            }
        ]"
      `);
      expect(weights).toEqual(fromJSON(json));
    });

    it("works for non-default weights", () => {
      const weights = defaultWeights();
      weights.nodeWeights.set(NodeAddress.empty, 32);
      weights.edgeWeights.set(EdgeAddress.empty, {
        forwards: 7,
        backwards: 9,
      });
      const json = toJSON(weights);
      const jsonString = stringify(json, {space: 4});
      expect(jsonString).toMatchInlineSnapshot(`
        "[
            {
                \\"type\\": \\"sourcecred/weights\\",
                \\"version\\": \\"0.2.0\\"
            },
            {
                \\"edgeWeights\\": {
                    \\"E\\\\u0000\\": {
                        \\"backwards\\": 9,
                        \\"forwards\\": 7
                    }
                },
                \\"nodeWeights\\": {
                    \\"N\\\\u0000\\": 32
                }
            }
        ]"
      `);
      expect(weights).toEqual(fromJSON(json));
    });
  });
});
