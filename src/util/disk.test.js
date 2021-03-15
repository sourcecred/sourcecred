// @flow

import {mkdirx, isDirEmpty} from "./disk";
import tmp from "tmp";
import fs from "fs-extra";
import {join as pathJoin} from "path";

describe("util/disk", () => {
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

  describe("isDirEmpty", () => {
    it("errors if path is not a directory", () => {
      const f = tmp.fileSync();
      let thunk = () => isDirEmpty(f.name);
      expect(thunk).toThrow(/^ENOTDIR/);
      const badName = tmp.tmpNameSync();
      thunk = () => isDirEmpty(badName);
      expect(thunk).toThrow(/^ENOENT/);
    });

    it("returns true if directory is empty", () => {
      const dir = tmp.dirSync();
      expect(isDirEmpty(dir.name)).toBe(true);
    });
    it("returns false if directory is not empty", () => {
      const dir = tmp.dirSync();
      fs.mkdirSync(pathJoin(dir.name, "childDir"));
      expect(isDirEmpty(dir.name)).toBe(false);
      fs.writeFileSync(pathJoin(dir.name, ".temphidden.txt"), "");
      expect(isDirEmpty(dir.name)).toBe(false);
      fs.writeFileSync(pathJoin(dir.name, "temp.txt"), "");
      expect(isDirEmpty(dir.name)).toBe(false);
      // cleanup: tmpDirs won't auto-delete if not empty
      fs.emptyDirSync(dir.name);
    });
  });
});
