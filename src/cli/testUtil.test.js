// @flow

import type {Command} from "./command";
import {run} from "./testUtil";

describe("cli/testUtil", () => {
  const testCommand: Command = async (args, std) => {
    switch (args[0]) {
      case "good":
        std.out("all");
        std.out("is");
        std.out("well");
        return 0;
      case "bad":
        std.out("something's");
        std.err("not");
        std.out("right");
        return 1;
      case "throw":
        std.out("???");
        std.err("what is going on");
        throw new Error(args[0]);
      case "reject":
        std.out("!!!");
        std.err("something is going on!");
        return Promise.reject(args[0]);
      default:
        console.error("Actually shouldn't happen");
        return 2;
    }
  };

  describe("run", () => {
    it("captures stdout with a successful command", async () => {
      expect(await run(testCommand, ["good"])).toEqual({
        exitCode: 0,
        stdout: ["all", "is", "well"],
        stderr: [],
      });
    });

    it("captures stderr with a failed command", async () => {
      expect(await run(testCommand, ["bad"])).toEqual({
        exitCode: 1,
        stdout: ["something's", "right"],
        stderr: ["not"],
      });
    });

    it("handles exceptions", async () => {
      expect(await run(testCommand, ["throw"])).toEqual({
        exitCode: 1,
        stdout: ["???"],
        stderr: [
          "what is going on",
          expect.stringMatching(/^Error: throw\n *at command/),
        ],
      });
    });

    it("handles exceptions", async () => {
      expect(await run(testCommand, ["reject"])).toEqual({
        exitCode: 1,
        stdout: ["!!!"],
        stderr: ["something is going on!", '"reject"'],
      });
    });
  });
});
