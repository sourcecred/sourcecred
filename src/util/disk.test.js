// @flow

import {
  loadFileWithDefault,
  loadJsonWithDefault,
  loadJson,
  mkdirx,
} from "./disk";
import tmp from "tmp";
import fs from "fs-extra";
import * as P from "./combo";
import {join as pathJoin} from "path";

describe("util/disk", () => {
  describe("loadJson / loadJsonWithDefault", () => {
    function tmpWithContents(contents: mixed) {
      const name = tmp.tmpNameSync();
      fs.writeFileSync(name, JSON.stringify(contents));
      return name;
    }
    const badPath = () => pathJoin(tmp.dirSync().name, "not-a-real-path");
    const fooParser = P.object({foo: P.number});
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
      const fail = async () => await loadJson(f, P.raw);
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
      const fail = async () => await loadJsonWithDefault(f, P.raw, fooDefault);
      await expect(fail).rejects.toThrow();
    });
    it("loadJsonWithDefault errors if file loading fails for a non-ENOENT reason", async () => {
      const directoryPath = tmp.dirSync().name;
      const fail = async () =>
        await loadJsonWithDefault(directoryPath, fooParser, fooDefault);
      await expect(fail).rejects.toThrow("EISDIR");
    });
  });

  describe("loadFileWithDefault", () => {
    const badPath = () => pathJoin(tmp.dirSync().name, "not-a-real-path");
    const unreachable = () => {
      throw new Error("Should not get here");
    };
    function tmpWithData(data: string) {
      const name = tmp.tmpNameSync();
      fs.writeFileSync(name, data);
      return name;
    }
    it("works when valid file is present", async () => {
      const f = tmpWithData("hello\n");
      expect(await loadFileWithDefault(f, unreachable)).toEqual("hello\n");
    });
    it("loads default if file not present", async () => {
      expect(await loadFileWithDefault(badPath(), () => "backup")).toEqual(
        "backup"
      );
    });
    it("errors if file loading fails for a non-ENOENT reason", async () => {
      const directoryPath = tmp.dirSync().name;
      const fail = async () =>
        await loadFileWithDefault(directoryPath, unreachable);
      await expect(fail).rejects.toThrow("EISDIR");
    });
  });

  describe("mkdirx", () => {
    it("makes the directory if it doesn't exist", () => {
      const name = tmp.tmpNameSync();
      mkdirx(name);
      const stat = fs.lstatSync(name);
      expect(stat.isDirectory()).toEqual(true);
    });
    it("silently no-ops if the directory does exist", () => {
      const name = tmp.tmpNameSync();
      mkdirx(name);
      mkdirx(name);
      const stat = fs.lstatSync(name);
      expect(stat.isDirectory()).toEqual(true);
    });
    it("does not create parent directories", () => {
      // This also checks that it properly thorws non-EEXIST errors.
      const name = tmp.tmpNameSync();
      const path = pathJoin(name, "foo");
      expect(() => mkdirx(path)).toThrowError(
        "ENOENT: no such file or directory"
      );
    });
  });
});
