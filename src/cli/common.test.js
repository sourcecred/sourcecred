// @flow

import {loadCurrencyDetails} from "./common";
import {DEFAULT_NAME, DEFAULT_SUFFIX} from "../api/currencyConfig";

describe("cli/common", () => {
  describe("loadCurrencyDetails", () => {
    it("returns default CurrencyDetails on missing config path", async () => {
      const {name, suffix} = await loadCurrencyDetails("");
      expect({name, suffix}).toEqual({
        name: DEFAULT_NAME,
        suffix: DEFAULT_SUFFIX,
      });
    });
  });
});
