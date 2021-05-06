// @flow

import {loadFileWithDefault, loadJsonWithDefault, loadJson} from "./storage";
import tmp from "tmp";
import fs from "fs-extra";
import * as P from "./combo";
import {join as pathJoin} from "path";
import {encode} from "../core/storage/textEncoding";
import {DiskStorage} from "../core/storage/disk";

describe("util/storage", () => {
  describe("loadJson / loadJsonWithDefault", () => {
    function tmpWithContents(contents: mixed, dir: string = basedir.name) {
      const name = tmp.tmpNameSync({dir});
      fs.writeFileSync(name, JSON.stringify(contents));
      const fname = name.split("/").pop();
      return fname;
    }
    const basedir = tmp.dirSync();
    const storage = new DiskStorage(basedir.name);
    const badPath = () => pathJoin(basedir.name, "not-a-real-path");
    const fooParser = P.object({foo: P.number});
    const fooInstance = Object.freeze({foo: 42});
    const fooDefault = () => ({foo: 1337});
    const barInstance = Object.freeze({bar: "1337"});
    it("loadJson works when valid file is present", async () => {
      const f = tmpWithContents(fooInstance);
      await expect(await loadJson(storage, f, fooParser)).toEqual(fooInstance);
    });
    it("loadJson errors if the path does not exist", async () => {
      const fail = async () => await loadJson(storage, badPath(), fooParser);
      await expect(fail).rejects.toThrow("ENOENT");
    });
    it("loadJson errors if the combo parse fails", async () => {
      const f = tmpWithContents(barInstance);
      const fail = async () => await loadJson(storage, f, fooParser);
      await expect(fail).rejects.toThrow("missing key");
    });
    it("loadJson errors if JSON.parse fails", async () => {
      const f = tmpWithContents("");
      await storage.set(f, encode("zzz"));
      const fail = async () => await loadJson(storage, f, P.raw);
      await expect(fail).rejects.toThrow();
    });
    it("loadJsonWithDefault works when valid file is present", async () => {
      const f = tmpWithContents(fooInstance);
      await expect(
        await loadJsonWithDefault(storage, f, fooParser, fooDefault)
      ).toEqual(fooInstance);
    });
    it("loadJsonWithDefault loads default if file not present", async () => {
      await expect(
        await loadJsonWithDefault(storage, badPath(), fooParser, fooDefault)
      ).toEqual(fooDefault());
    });
    it("loadJsonWithDefault errors if parse fails", async () => {
      const f = tmpWithContents(barInstance);
      const fail = async () =>
        await loadJsonWithDefault(storage, f, fooParser, fooDefault);
      await expect(fail).rejects.toThrow("missing key");
    });
    it("loadJsonWithDefault errors if JSON.parse fails", async () => {
      const f = tmpWithContents("");
      await storage.set(f, encode("zzz"));
      const fail = async () =>
        await loadJsonWithDefault(storage, f, P.raw, fooDefault);
      await expect(fail).rejects.toThrow();
    });
    it("loadJsonWithDefault errors if file loading fails for a non-ENOENT reason", async () => {
      const fail = async () =>
        await loadJsonWithDefault(storage, "", fooParser, fooDefault);
      await expect(fail).rejects.toThrow("EISDIR");
    });
  });

  describe("loadFileWithDefault", () => {
    const badPath = () => pathJoin(tmp.dirSync().name, "not-a-real-path");
    const unreachable = () => {
      throw new Error("Should not get here");
    };
    function tmpWithData(data: string, dir: string = basedir.name) {
      const name = tmp.tmpNameSync({dir});
      fs.writeFileSync(name, data);
      const fname = name.split("/").pop();
      return fname;
    }
    const basedir = tmp.dirSync();
    const storage = new DiskStorage(basedir.name);
    it("works when valid file is present", async () => {
      const f = tmpWithData("hello\n");
      expect(await loadFileWithDefault(storage, f, unreachable)).toEqual(
        "hello\n"
      );
    });
    it("loads default if file not present", async () => {
      expect(
        await loadFileWithDefault(storage, badPath(), () => "backup")
      ).toEqual("backup");
    });
    it("errors if file loading fails for a non-ENOENT reason", async () => {
      const directoryPath = "";
      const fail = async () =>
        await loadFileWithDefault(storage, directoryPath, unreachable);
      await expect(fail).rejects.toThrow("EISDIR");
    });
  });
});
