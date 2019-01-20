// @flow

import {defaultWeightsForAdapter, defaultWeightsForAdapterSet} from "./weights";
import {
  defaultWeightsForDeclaration,
  combineWeights,
} from "../../analysis/weights";
import {declaration} from "../../plugins/demo/declaration";
import {
  FactorioStaticAdapter,
  staticExplorerAdapterSet,
} from "../../plugins/demo/explorerAdapter";

describe("explorer/weights/weights", () => {
  describe("defaultWeightsForAdapter", () => {
    it("works on the demo adapter", () => {
      const adapter = new FactorioStaticAdapter();
      const expected = defaultWeightsForDeclaration(declaration);
      expect(defaultWeightsForAdapter(adapter)).toEqual(expected);
    });
  });

  describe("defaultWeightsForAdapterSet", () => {
    it("works on a demo adapter set", () => {
      expect(defaultWeightsForAdapterSet(staticExplorerAdapterSet())).toEqual(
        combineWeights(
          staticExplorerAdapterSet()
            .adapters()
            .map(defaultWeightsForAdapter)
        )
      );
    });
  });
});
