// @flow

import {run} from "./testUtil";
import sourcecred from "./sourcecred";

function mockCommand(name) {
  return jest.fn().mockImplementation(async (args, std) => {
    std.out(`out(${name}): ${JSON.stringify(args)}`);
    std.err(`err(${name})`);
    return args.length;
  });
}

jest.mock("./help", () => mockCommand("help"));
jest.mock("./load", () => mockCommand("load"));
jest.mock("./graph", () => mockCommand("graph"));

describe("cli/sourcecred", () => {
  it("fails with usage when invoked with no arguments", async () => {
    expect(await run(sourcecred, [])).toEqual({
      exitCode: 1,
      stdout: [],
      stderr: ["out(help): []", "err(help)"],
    });
  });

  it("responds to '--version'", async () => {
    expect(await run(sourcecred, ["--version"])).toEqual({
      exitCode: 0,
      stdout: [expect.stringMatching(/^sourcecred v\d+\.\d+\.[a-z\d-]+$/)],
      stderr: [],
    });
  });

  it("responds to '--help'", async () => {
    expect(await run(sourcecred, ["--help"])).toEqual({
      exitCode: 0,
      stdout: ["out(help): []"],
      stderr: ["err(help)"],
    });
  });

  it("responds to 'help'", async () => {
    expect(await run(sourcecred, ["help"])).toEqual({
      exitCode: 0,
      stdout: ["out(help): []"],
      stderr: ["err(help)"],
    });
  });

  it("fails given an unknown command", async () => {
    expect(await run(sourcecred, ["wat"])).toEqual({
      exitCode: 1,
      stdout: [],
      stderr: [
        'fatal: unknown command: "wat"',
        "fatal: run 'sourcecred help' for commands and usage",
      ],
    });
  });
});
