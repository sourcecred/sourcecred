// @flow

import path from "path";
import tmp from "tmp";
import fs from "fs";

import {makeClear, removeDir, help} from "./clear";
import {run} from "./testUtil";
import * as Common from "./common";

describe("cli/clear", () => {
  describe("'help' command", () => {
    it("prints usage when given no arguments", async () => {
      expect(await run(help, [])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred clear/),
        ]),
        stderr: [],
      });
    });

    it("fails when given arguments", async () => {
      expect(await run(help, ["foo/bar"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred clear/),
        ]),
      });
    });
  });

  describe("'makeClear' command", () => {
    it("prints usage with '--help'", async () => {
      const clear = makeClear(jest.fn());
      expect(await run(clear, ["--help"])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred clear/),
        ]),
        stderr: [],
      });
    });

    it("fails when no arguments specified", async () => {
      const clear = makeClear(jest.fn());
      expect(await run(clear, [])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: no arguments provided",
          "fatal: run 'sourcecred help clear' for help",
        ],
      });
    });

    it("fails when an invalid argument is specified", async () => {
      const clear = makeClear(jest.fn());
      expect(await run(clear, ["invalid"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: unrecognized argument: 'invalid'",
          "fatal: run 'sourcecred help clear' for help",
        ],
      });
    });

    it("fails when more than one argument specified", async () => {
      const clear = makeClear(jest.fn());
      expect(await run(clear, ["1", "2"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: expected 1 argument but recieved: 2 arguments",
          "fatal: run 'sourcecred help clear' for help",
        ],
      });
    });

    it("passes correct param to removeDir with `--all`", async () => {
      const rmDir = jest.fn();
      const clear = makeClear(rmDir);
      await run(clear, ["--all"]);
      expect(rmDir).toHaveBeenCalledWith(Common.sourcecredDirectory());
    });

    it("passes correct param to removeDir with `--cache`", async () => {
      const rmDir = jest.fn();
      const clear = makeClear(rmDir);
      await run(clear, ["--cache"]);
      const cacheDir = path.join(Common.sourcecredDirectory(), "cache");
      expect(rmDir).toHaveBeenCalledWith(cacheDir);
    });

    function throwError() {
      return Promise.reject(new Error("test error"));
    }

    it("--all returns error if removeDir errors", async () => {
      const clear = makeClear(throwError);
      expect(await run(clear, ["--all"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: Error: test error",
          "fatal: run 'sourcecred help clear' for help",
        ],
      });
    });

    it("--cache returns error if removeDir errors", async () => {
      const clear = makeClear(throwError);
      expect(await run(clear, ["--cache"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: [
          "fatal: Error: test error",
          "fatal: run 'sourcecred help clear' for help",
        ],
      });
    });
  });

  describe("rimraf", () => {
    it("removes the correct directory", async () => {
      const dir = tmp.dirSync();
      expect(fs.existsSync(dir.name)).toBe(true);
      await removeDir(dir.name);
      expect(fs.existsSync(dir.name)).toBe(false);
    });
  });
});
