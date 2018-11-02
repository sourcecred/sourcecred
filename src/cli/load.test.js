// @flow

import fs from "fs";
import path from "path";
import tmp from "tmp";

import {run} from "./testUtil";
import load, {help} from "./load";

import * as RepoIdRegistry from "../core/repoIdRegistry";
import {stringToRepoId} from "../core/repoId";

jest.mock("../tools/execDependencyGraph", () => jest.fn());
jest.mock("../plugins/github/loadGithubData", () => ({
  loadGithubData: jest.fn(),
}));
jest.mock("../plugins/git/loadGitData", () => ({
  loadGitData: jest.fn(),
}));

type JestMockFn = $Call<typeof jest.fn>;
const execDependencyGraph: JestMockFn = (require("../tools/execDependencyGraph"): any);
const loadGithubData: JestMockFn = (require("../plugins/github/loadGithubData")
  .loadGithubData: any);
const loadGitData: JestMockFn = (require("../plugins/git/loadGitData")
  .loadGitData: any);

describe("cli/load", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Tests should call `newSourcecredDirectory` directly when they
    // need the value. We call it here in case a test needs it to be set
    // but does not care about the particular value.
    newSourcecredDirectory();
  });

  const fakeGithubToken = "....".replace(/./g, "0123456789");
  function newSourcecredDirectory() {
    const dirname = tmp.dirSync().name;
    process.env.SOURCECRED_DIRECTORY = dirname;
    process.env.SOURCECRED_GITHUB_TOKEN = fakeGithubToken;
    return dirname;
  }

  describe("'help' command", () => {
    it("prints usage when given no arguments", async () => {
      expect(await run(help, [])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred load/),
        ]),
        stderr: [],
      });
    });
    it("fails when given arguments", async () => {
      expect(await run(help, ["foo/bar"])).toEqual({
        exitCode: 1,
        stdout: [],
        stderr: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred load/),
        ]),
      });
    });
  });

  describe("'load' command", () => {
    it("prints usage with '--help'", async () => {
      expect(await run(load, ["--help"])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred load/),
        ]),
        stderr: [],
      });
    });

    describe("for multiple repositories", () => {
      it("fails when no output is specified for two repoIds", async () => {
        expect(
          await run(load, ["foo/bar", "foo/baz", "--plugin", "git"])
        ).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: output repository not specified",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
      it("fails when no output is specified for zero repoIds", async () => {
        expect(await run(load, ["--plugin", "git"])).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: output repository not specified",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
      it("fails when '--output' is given without a value", async () => {
        expect(await run(load, ["foo/bar", "--output"])).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: '--output' given without value",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
      it("fails when the same '--output' is given multiple times", async () => {
        expect(
          await run(load, [
            "foo/bar",
            "--output",
            "foo/baz",
            "--output",
            "foo/baz",
          ])
        ).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: '--output' given multiple times",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
      it("fails when multiple '--output's are given", async () => {
        expect(
          await run(load, [
            "foo/bar",
            "--output",
            "foo/baz",
            "--output",
            "foo/quux",
          ])
        ).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: '--output' given multiple times",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
    });

    describe("when loading single-plugin data", () => {
      it("fails for an unknown plugin", async () => {
        expect(await run(load, ["foo/bar", "--plugin", "wat"])).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            'fatal: unknown plugin: "wat"',
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
      it("fails when '--plugin' is given without a value", async () => {
        expect(await run(load, ["foo/bar", "--plugin"])).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: '--plugin' given without value",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
      it("fails when the same plugin is specified multiple times", async () => {
        expect(
          await run(load, ["foo/bar", "--plugin", "git", "--plugin", "git"])
        ).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: '--plugin' given multiple times",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
      it("fails when multiple plugins are specified", async () => {
        expect(
          await run(load, ["foo/bar", "--plugin", "git", "--plugin", "github"])
        ).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: '--plugin' given multiple times",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });

      describe("for the Git plugin", () => {
        it("correctly loads data", async () => {
          const sourcecredDirectory = newSourcecredDirectory();
          loadGitData.mockResolvedValueOnce(undefined);
          expect(await run(load, ["foo/bar", "--plugin", "git"])).toEqual({
            exitCode: 0,
            stdout: [],
            stderr: [],
          });

          expect(execDependencyGraph).not.toHaveBeenCalled();
          expect(loadGitData).toHaveBeenCalledTimes(1);
          expect(loadGitData).toHaveBeenCalledWith({
            repoIds: [stringToRepoId("foo/bar")],
            outputDirectory: path.join(
              sourcecredDirectory,
              "data",
              "foo",
              "bar",
              "git"
            ),
            cacheDirectory: path.join(
              sourcecredDirectory,
              "cache",
              "foo",
              "bar",
              "git"
            ),
          });
        });

        it("fails if `loadGitData` rejects", async () => {
          loadGitData.mockRejectedValueOnce("please install Git");
          expect(await run(load, ["foo/bar", "--plugin", "git"])).toEqual({
            exitCode: 1,
            stdout: [],
            stderr: ['"please install Git"'],
          });
        });
      });

      it("succeeds for multiple repositories", async () => {
        const sourcecredDirectory = newSourcecredDirectory();
        loadGitData.mockResolvedValueOnce(undefined);
        expect(
          await run(load, [
            "foo/bar",
            "foo/baz",
            "--output",
            "foo/combined",
            "--plugin",
            "git",
          ])
        ).toEqual({
          exitCode: 0,
          stdout: [],
          stderr: [],
        });

        expect(execDependencyGraph).not.toHaveBeenCalled();
        expect(loadGitData).toHaveBeenCalledTimes(1);
        expect(loadGitData).toHaveBeenCalledWith({
          repoIds: [stringToRepoId("foo/bar"), stringToRepoId("foo/baz")],
          outputDirectory: path.join(
            sourcecredDirectory,
            "data",
            "foo",
            "combined",
            "git"
          ),
          cacheDirectory: path.join(
            sourcecredDirectory,
            "cache",
            "foo",
            "combined",
            "git"
          ),
        });
      });

      describe("for the GitHub plugin", () => {
        it("correctly loads data", async () => {
          const sourcecredDirectory = newSourcecredDirectory();
          loadGithubData.mockResolvedValueOnce(undefined);
          expect(await run(load, ["foo/bar", "--plugin", "github"])).toEqual({
            exitCode: 0,
            stdout: [],
            stderr: [],
          });

          expect(execDependencyGraph).not.toHaveBeenCalled();
          expect(loadGithubData).toHaveBeenCalledTimes(1);
          expect(loadGithubData).toHaveBeenCalledWith({
            token: fakeGithubToken,
            repoIds: [stringToRepoId("foo/bar")],
            outputDirectory: path.join(
              sourcecredDirectory,
              "data",
              "foo",
              "bar",
              "github"
            ),
            cacheDirectory: path.join(
              sourcecredDirectory,
              "cache",
              "foo",
              "bar",
              "github"
            ),
          });
        });

        it("fails if a token is not provided", async () => {
          delete process.env.SOURCECRED_GITHUB_TOKEN;
          expect(await run(load, ["foo/bar", "--plugin", "github"])).toEqual({
            exitCode: 1,
            stdout: [],
            stderr: [
              "fatal: no GitHub token specified",
              "fatal: run 'sourcecred help load' for help",
            ],
          });
        });

        it("fails if `loadGithubData` rejects", async () => {
          loadGithubData.mockRejectedValueOnce("GitHub is down");
          expect(await run(load, ["foo/bar", "--plugin", "github"])).toEqual({
            exitCode: 1,
            stdout: [],
            stderr: ['"GitHub is down"'],
          });
        });
      });
    });

    describe("when loading data for all plugins", () => {
      it("fails if a GitHub token is not provided", async () => {
        delete process.env.SOURCECRED_GITHUB_TOKEN;
        expect(await run(load, ["foo/bar"])).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [
            "fatal: no GitHub token specified",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });

      it("invokes `execDependencyGraph` with a correct set of tasks", async () => {
        execDependencyGraph.mockResolvedValueOnce({success: true});
        expect(
          await run(load, ["foo/bar", "foo/baz", "--output", "foo/combined"])
        ).toEqual({
          exitCode: 0,
          stdout: [],
          stderr: [],
        });
        expect(execDependencyGraph).toHaveBeenCalledTimes(1);
        const tasks = execDependencyGraph.mock.calls[0][0];
        expect(tasks).toHaveLength(["git", "github"].length);
        expect(tasks.map((task) => task.id)).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/git(?!hub)/),
            expect.stringMatching(/github/),
          ])
        );
        for (const task of tasks) {
          expect(task.cmd).toEqual([
            expect.stringMatching(/\bnode\b/),
            expect.stringMatching(/--max_old_space_size=/),
            process.argv[1],
            "load",
            "foo/bar",
            "foo/baz",
            "--output",
            "foo/combined",
            "--plugin",
            expect.stringMatching(/^(?:git|github)$/),
          ]);
        }
      });

      it("properly infers the output when loading a single repository", async () => {
        execDependencyGraph.mockResolvedValueOnce({success: true});
        expect(await run(load, ["foo/bar"])).toEqual({
          exitCode: 0,
          stdout: [],
          stderr: [],
        });
        expect(execDependencyGraph).toHaveBeenCalledTimes(1);
        const tasks = execDependencyGraph.mock.calls[0][0];
        for (const task of tasks) {
          expect(task.cmd).toEqual([
            expect.stringMatching(/\bnode\b/),
            expect.stringMatching(/--max_old_space_size=/),
            process.argv[1],
            "load",
            "foo/bar",
            "--output",
            "foo/bar",
            "--plugin",
            expect.stringMatching(/^(?:git|github)$/),
          ]);
        }
      });

      it("fails if `execDependencyGraph` returns failure", async () => {
        execDependencyGraph.mockResolvedValueOnce({success: false});
        expect(
          await run(load, ["foo/bar", "foo/baz", "--output", "foo/combined"])
        ).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: [],
        });
      });

      it("fails if `execDependencyGraph` rejects", async () => {
        execDependencyGraph.mockRejectedValueOnce({success: "definitely not"});
        expect(
          await run(load, ["foo/bar", "foo/baz", "--output", "foo/combined"])
        ).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: ['{"success":"definitely not"}'],
        });
      });

      it("writes a new repository registry if one does not exist", async () => {
        const sourcecredDirectory = newSourcecredDirectory();
        execDependencyGraph.mockResolvedValueOnce({success: true});
        await run(load, ["foo/bar", "foo/baz", "--output", "foo/combined"]);
        const blob = fs
          .readFileSync(
            path.join(sourcecredDirectory, RepoIdRegistry.REPO_ID_REGISTRY_FILE)
          )
          .toString();
        const registry = RepoIdRegistry.fromJSON(JSON.parse(blob));
        const expected: RepoIdRegistry.RepoIdRegistry = [
          {repoId: stringToRepoId("foo/combined")},
        ];
        expect(registry).toEqual(expected);
      });

      it("appends to an existing registry", async () => {
        const sourcecredDirectory = newSourcecredDirectory();
        fs.writeFileSync(
          path.join(sourcecredDirectory, RepoIdRegistry.REPO_ID_REGISTRY_FILE),
          JSON.stringify(
            RepoIdRegistry.toJSON([
              {repoId: stringToRepoId("previous/one")},
              {repoId: stringToRepoId("previous/two")},
            ])
          )
        );
        execDependencyGraph.mockResolvedValueOnce({success: true});
        await run(load, ["foo/bar", "foo/baz", "--output", "foo/combined"]);
        const blob = fs
          .readFileSync(
            path.join(sourcecredDirectory, RepoIdRegistry.REPO_ID_REGISTRY_FILE)
          )
          .toString();
        const registry = RepoIdRegistry.fromJSON(JSON.parse(blob));
        const expected: RepoIdRegistry.RepoIdRegistry = [
          {repoId: stringToRepoId("previous/one")},
          {repoId: stringToRepoId("previous/two")},
          {repoId: stringToRepoId("foo/combined")},
        ];
        expect(registry).toEqual(expected);
      });
    });
  });
});
