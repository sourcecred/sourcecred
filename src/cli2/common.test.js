// @flow

import {loadJson, loadJsonWithDefault} from "./common";
import tmp from "tmp";
import fs from "fs-extra";
import * as C from "../util/combo";
import {join as pathJoin} from "path";

describe("cli2/common", () => {
  function tmpWithContents(contents: mixed) {
    const name = tmp.tmpNameSync();
    fs.writeFileSync(name, JSON.stringify(contents));
    return name;
  }
  describe("loadJson / loadJsonWithDefault", () => {
    const badPath = () => pathJoin(tmp.dirSync().name, "not-a-real-path");
    const fooParser = C.object({foo: C.number});
    const fooInstance = Object.freeze({foo: 42});
    const fooDefault = () => ({foo: 1337});
    const barInstance = Object.freeze({bar: "1337"});
    it("loadJson works when valid file is present", async () => {
      const f = tmpWithContents(fooInstance);
      expect(await loadJson(f, fooParser)).toEqual(fooInstance);
    });
    it("loadJson errors if the path does not exist", async () => {
      const fail = async () => await loadJson(badPath(), fooParser);
      await expect(fail).rejects.toThrow("ENOENT");
    });
    it("loadJson errors if the combo parse fails", async () => {
      const f = tmpWithContents(barInstance);
      const fail = async () => await loadJson(f, fooParser);
      await expect(fail).rejects.toThrow("missing key");
    });
    it("loadJson errors if JSON.parse fails", async () => {
      const f = tmp.tmpNameSync();
      fs.writeFileSync(f, "zzz");
      const fail = async () => await loadJson(f, C.raw);
      await expect(fail).rejects.toThrow();
    });
    it("loadJsonWithDefault works when valid file is present", async () => {
      const f = tmpWithContents(fooInstance);
      expect(await loadJsonWithDefault(f, fooParser, fooDefault)).toEqual(
        fooInstance
      );
    });
    it("loadJsonWithDefault loads default if file not present", async () => {
      expect(
        await loadJsonWithDefault(badPath(), fooParser, fooDefault)
      ).toEqual(fooDefault());
    });
    it("loadJsonWithDefault errors if parse fails", async () => {
      const f = tmpWithContents(barInstance);
      const fail = async () =>
        await loadJsonWithDefault(f, fooParser, fooDefault);
      await expect(fail).rejects.toThrow("missing key");
    });
    it("loadJsonWithDefault errors if JSON.parse fails", async () => {
      const f = tmp.tmpNameSync();
      fs.writeFileSync(f, "zzz");
      const fail = async () => await loadJsonWithDefault(f, C.raw, fooDefault);
      await expect(fail).rejects.toThrow();
    });
    it("loadJsonWithDefault errors if file loading fails for a non-ENOENT reason", async () => {
      const directoryPath = tmp.dirSync().name;
      const fail = async () =>
        await loadJsonWithDefault(directoryPath, fooParser, fooDefault);
      await expect(fail).rejects.toThrow("EISDIR");
    });
  });
});
