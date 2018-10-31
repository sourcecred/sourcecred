// @flow

import {defaultWeightsForAdapter, defaultWeightsForAdapterSet} from "./weights";
import {
  defaultWeightsForDeclaration,
  combineWeights,
} from "../../../analysis/weights";
import {declaration} from "../../../plugins/demo/declaration";
import {
  FactorioStaticAdapter,
  staticAdapterSet,
} from "../../../plugins/demo/appAdapter";

describe("app/credExplorer/weights/weights", () => {
  describe("defaultWeightsForAdapter", () => {
    it("works on the demo adapter", () => {
      const adapter = new FactorioStaticAdapter();
      const expected = defaultWeightsForDeclaration(declaration);
      expect(defaultWeightsForAdapter(adapter)).toEqual(expected);
    });
  });

  describe("defaultWeightsForAdapterSet", () => {
    it("works on a demo adapter set", () => {
      expect(defaultWeightsForAdapterSet(staticAdapterSet())).toEqual(
        combineWeights(
          staticAdapterSet()
            .adapters()
            .map(defaultWeightsForAdapter)
        )
      );
    });
  });
});
