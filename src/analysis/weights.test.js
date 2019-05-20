// @flow

import stringify from "json-stable-stringify";
import {NodeAddress, EdgeAddress} from "../core/graph";
import {toJSON, fromJSON, defaultWeights} from "./weights";

describe("analysis/weights", () => {
  describe("toJSON/fromJSON", () => {
    it("works for the default weights", () => {
      const weights = defaultWeights();
      const json = toJSON(weights);
      const jsonString = stringify(json, {space: 4});
      expect(jsonString).toMatchInlineSnapshot(`
"[
    {
        \\"type\\": \\"sourcecred/weights\\",
        \\"version\\": \\"0.1.0\\"
    },
    {
        \\"edgeTypeWeights\\": {
        },
        \\"nodeManualWeights\\": {
        },
        \\"nodeTypeWeights\\": {
        }
    }
]"
`);
      expect(weights).toEqual(fromJSON(json));
    });

    it("works for non-default weights", () => {
      const weights = defaultWeights();
      weights.nodeTypeWeights.set(NodeAddress.empty, 32);
      weights.edgeTypeWeights.set(EdgeAddress.empty, {
        forwards: 7,
        backwards: 9,
      });
      weights.nodeManualWeights.set(NodeAddress.fromParts(["foo"]), 42);
      const json = toJSON(weights);
      const jsonString = stringify(json, {space: 4});
      expect(jsonString).toMatchInlineSnapshot(`
"[
    {
        \\"type\\": \\"sourcecred/weights\\",
        \\"version\\": \\"0.1.0\\"
    },
    {
        \\"edgeTypeWeights\\": {
            \\"E\\\\u0000\\": {
                \\"backwards\\": 9,
                \\"forwards\\": 7
            }
        },
        \\"nodeManualWeights\\": {
            \\"N\\\\u0000foo\\\\u0000\\": 42
        },
        \\"nodeTypeWeights\\": {
            \\"N\\\\u0000\\": 32
        }
    }
]"
`);
      expect(weights).toEqual(fromJSON(json));
    });
  });
});
