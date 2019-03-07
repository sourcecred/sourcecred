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
jest.mock("./analyze", () => mockCommand("analyze"));
jest.mock("./exportGraph", () => mockCommand("export-graph"));
jest.mock("./pagerank", () => mockCommand("pagerank"));

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
      stdout: [expect.stringMatching(/^sourcecred v\d+\.\d+\.\d+$/)],
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

  it("responds to 'load'", async () => {
    expect(await run(sourcecred, ["load", "foo/bar", "foo/baz"])).toEqual({
      exitCode: 2,
      stdout: ['out(load): ["foo/bar","foo/baz"]'],
      stderr: ["err(load)"],
    });
  });

  it("responds to 'analyze'", async () => {
    expect(await run(sourcecred, ["analyze", "foo/bar", "foo/baz"])).toEqual({
      exitCode: 2,
      stdout: ['out(analyze): ["foo/bar","foo/baz"]'],
      stderr: ["err(analyze)"],
    });
  });

  it("responds to 'export-graph'", async () => {
    expect(
      await run(sourcecred, ["export-graph", "foo/bar", "foo/baz"])
    ).toEqual({
      exitCode: 2,
      stdout: ['out(export-graph): ["foo/bar","foo/baz"]'],
      stderr: ["err(export-graph)"],
    });
  });

  it("responds to 'pagerank'", async () => {
    expect(await run(sourcecred, ["pagerank", "foo/bar", "foo/baz"])).toEqual({
      exitCode: 2,
      stdout: ['out(pagerank): ["foo/bar","foo/baz"]'],
      stderr: ["err(pagerank)"],
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
