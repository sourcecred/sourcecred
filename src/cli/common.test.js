// @flow

import {loadCurrencyDetails} from "./common";
import {DEFAULT_NAME, DEFAULT_SUFFIX} from "../api/currencyConfig";
import {DiskStorage} from "../core/storage/disk";
import {tmpdir} from "os";

describe("cli/common", () => {
  describe("loadCurrencyDetails", () => {
    it("returns default CurrencyDetails on missing config file", async () => {
      const {name, suffix} = await loadCurrencyDetails(
        new DiskStorage(tmpdir()),
        "currency.json"
      );
      expect({name, suffix}).toEqual({
        name: DEFAULT_NAME,
        suffix: DEFAULT_SUFFIX,
      });
    });
  });
});
