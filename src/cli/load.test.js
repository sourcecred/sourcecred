// @flow

import path from "path";
import tmp from "tmp";

import {Graph} from "../core/graph";
import {run} from "./testUtil";
import {defaultPlugins} from "./common";
import {
  makeLoadCommand,
  makeLoadDefaultPlugins,
  loadIndividualPlugin,
  help,
} from "./load";

import * as RepoIdRegistry from "../core/repoIdRegistry";
import {makeRepoId} from "../core/repoId";
import {defaultAdapterLoaders} from "./pagerank";

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

  describe("'load' command wrapper", () => {
    function setup() {
      const loadIndividualPlugin: any = jest.fn();
      const loadDefaultPlugins: any = jest.fn();
      const loadCommand = makeLoadCommand(
        loadIndividualPlugin,
        loadDefaultPlugins
      );
      return {loadIndividualPlugin, loadDefaultPlugins, loadCommand};
    }

    it("prints usage with '--help'", async () => {
      const {loadCommand} = setup();
      expect(await run(loadCommand, ["--help"])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred load/),
        ]),
        stderr: [],
      });
    });

    it("calls loadDefaultPlugins if plugin not specified", async () => {
      const {loadCommand, loadDefaultPlugins} = setup();
      const invocation = run(loadCommand, ["foo/bar"]);
      expect(await invocation).toEqual({
        exitCode: 0,
        stdout: [],
        stderr: [],
      });
      const repoId = makeRepoId("foo", "bar");
      const expectedOptions = {repoIds: [repoId], output: repoId};
      expect(loadDefaultPlugins).toHaveBeenCalledWith(expectedOptions);
    });

    it("calls loadIndividualPlugin if plugin explicitly specified", async () => {
      const {loadCommand, loadIndividualPlugin} = setup();
      const invocation = run(loadCommand, ["foo/bar", "--plugin", "git"]);
      expect(await invocation).toEqual({
        exitCode: 0,
        stdout: [],
        stderr: [],
      });
      const repoId = makeRepoId("foo", "bar");
      const expectedOptions = {repoIds: [repoId], output: repoId};
      expect(loadIndividualPlugin).toHaveBeenCalledWith("git", expectedOptions);
    });

    describe("errors if", () => {
      async function expectFailure({args, message}) {
        const {loadCommand, loadIndividualPlugin, loadDefaultPlugins} = setup();
        expect(await run(loadCommand, args)).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: message,
        });
        expect(loadIndividualPlugin).not.toHaveBeenCalled();
        expect(loadDefaultPlugins).not.toHaveBeenCalled();
      }

      it("no repos provided, and no output repository", async () => {
        await expectFailure({
          args: [],
          message: [
            "fatal: output repository not specified",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });

      it("multiple repos provided without output repository", async () => {
        await expectFailure({
          args: ["foo/bar", "zoink/zod"],
          message: [
            "fatal: output repository not specified",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });

      it("the repo identifier is invalid", async () => {
        await expectFailure({
          args: ["missing_delimiter"],
          message: [
            expect.stringMatching(
              "^Error: Invalid repo string: missing_delimiter"
            ),
          ],
        });
      });

      it("the SOURCECRED_GITHUB_TOKEN is unset", async () => {
        delete process.env.SOURCECRED_GITHUB_TOKEN;
        await expectFailure({
          args: ["missing_delimiter"],
          message: [
            "fatal: no GitHub token specified",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });

      describe("the plugin flag", () => {
        it("not a valid plugin", async () => {
          await expectFailure({
            args: ["foo/bar", "--plugin", "foo"],
            message: [
              'fatal: unknown plugin: "foo"',
              "fatal: run 'sourcecred help load' for help",
            ],
          });
        });

        it("provided multiple times", async () => {
          await expectFailure({
            args: ["foo/bar", "--plugin", "git", "--plugin", "github"],
            message: [
              "fatal: '--plugin' given multiple times",
              "fatal: run 'sourcecred help load' for help",
            ],
          });
        });

        it("provided multiple times with the same plugin", async () => {
          await expectFailure({
            args: ["foo/bar", "--plugin", "git", "--plugin", "git"],
            message: [
              "fatal: '--plugin' given multiple times",
              "fatal: run 'sourcecred help load' for help",
            ],
          });
        });

        it("provided without a value", async () => {
          await expectFailure({
            args: ["foo/bar", "--plugin"],
            message: [
              "fatal: '--plugin' given without value",
              "fatal: run 'sourcecred help load' for help",
            ],
          });
        });

        describe("the output flag is", () => {
          it("provided multiple times", async () => {
            await expectFailure({
              args: ["--output", "foo/bar", "--output", "bar/zod"],
              message: [
                "fatal: '--output' given multiple times",
                "fatal: run 'sourcecred help load' for help",
              ],
            });
          });

          it("provided multiple times with the same value", async () => {
            await expectFailure({
              args: ["--output", "foo/bar", "--output", "foo/bar"],
              message: [
                "fatal: '--output' given multiple times",
                "fatal: run 'sourcecred help load' for help",
              ],
            });
          });

          it("not given a value", async () => {
            await expectFailure({
              args: ["--output"],
              message: [
                "fatal: '--output' given without value",
                "fatal: run 'sourcecred help load' for help",
              ],
            });
          });

          it("not a valid RepoId", async () => {
            await expectFailure({
              args: ["--output", "missing_delimiter"],
              message: [
                expect.stringMatching(
                  "^Error: Invalid repo string: missing_delimiter"
                ),
              ],
            });
          });
        });

        describe("processes options correctly", () => {
          function successCase({name, args, loadOptions}) {
            it(name + " (no plugin)", async () => {
              const {
                loadCommand,
                loadIndividualPlugin,
                loadDefaultPlugins,
              } = setup();
              expect(await run(loadCommand, args)).toEqual({
                exitCode: 0,
                stdout: [],
                stderr: [],
              });
              expect(loadIndividualPlugin).not.toHaveBeenCalled();
              expect(loadDefaultPlugins).toHaveBeenCalledWith(loadOptions);
            });
            it(name + " (with plugin)", async () => {
              const {
                loadCommand,
                loadIndividualPlugin,
                loadDefaultPlugins,
              } = setup();
              const pluginArgs = args.concat(["--plugin", "git"]);
              expect(await run(loadCommand, pluginArgs)).toEqual({
                exitCode: 0,
                stdout: [],
                stderr: [],
              });
              expect(loadIndividualPlugin).toHaveBeenCalledWith(
                "git",
                loadOptions
              );
              expect(loadDefaultPlugins).not.toHaveBeenCalled();
            });
          }

          const fooBar = makeRepoId("foo", "bar");
          const barZod = makeRepoId("bar", "zod");
          successCase({
            name: "with a single repository",
            args: ["foo/bar"],
            loadOptions: {output: fooBar, repoIds: [fooBar]},
          });
          successCase({
            name: "with a multiple repositories",
            args: ["foo/bar", "bar/zod", "--output", "bar/zod"],
            loadOptions: {output: barZod, repoIds: [fooBar, barZod]},
          });
          successCase({
            name: "with zero repositories",
            args: ["--output", "bar/zod"],
            loadOptions: {output: barZod, repoIds: []},
          });
        });

        it("reports to stderr if loadDefaultPlugins rejects", async () => {
          const {loadCommand, loadDefaultPlugins} = setup();
          loadDefaultPlugins.mockRejectedValueOnce(
            Error("loadDefaultPlugins failed.")
          );
          expect(await run(loadCommand, ["foo/bar"])).toEqual({
            exitCode: 1,
            stdout: [],
            stderr: ["loadDefaultPlugins failed."],
          });
        });

        it("reports to stderr if loadIndividualPlugin rejects", async () => {
          const {loadCommand, loadIndividualPlugin} = setup();
          loadIndividualPlugin.mockRejectedValueOnce(
            Error("loadIndividualPlugin failed.")
          );
          expect(
            await run(loadCommand, ["foo/bar", "--plugin", "git"])
          ).toEqual({
            exitCode: 1,
            stdout: [],
            stderr: ["loadIndividualPlugin failed."],
          });
        });

        describe("loadIndividualPlugin", () => {
          const fooCombined = makeRepoId("foo", "combined");
          const fooBar = makeRepoId("foo", "bar");
          const fooBaz = makeRepoId("foo", "baz");

          describe("for the Git plugin", () => {
            it("correctly loads data", async () => {
              const sourcecredDirectory = newSourcecredDirectory();
              loadGitData.mockResolvedValueOnce(undefined);
              await loadIndividualPlugin("git", {
                repoIds: [fooBar],
                output: fooBar,
              });

              expect(execDependencyGraph).not.toHaveBeenCalled();
              expect(loadGitData).toHaveBeenCalledTimes(1);
              expect(loadGitData).toHaveBeenCalledWith({
                repoIds: [fooBar],
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

            it("rejects if `loadGitData` rejects", async () => {
              loadGitData.mockRejectedValueOnce(Error("please install Git"));
              const attempt = loadIndividualPlugin("git", {
                repoIds: [fooBar],
                output: fooBar,
              });
              expect(attempt).rejects.toThrow("please install Git");
            });
          });

          it("succeeds for multiple repositories", async () => {
            const sourcecredDirectory = newSourcecredDirectory();
            loadGitData.mockResolvedValueOnce(undefined);
            const options = {repoIds: [fooBar, fooBaz], output: fooCombined};
            await loadIndividualPlugin("git", options);

            expect(execDependencyGraph).not.toHaveBeenCalled();
            expect(loadGitData).toHaveBeenCalledTimes(1);
            expect(loadGitData).toHaveBeenCalledWith({
              repoIds: [fooBar, fooBaz],
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
              const options = {repoIds: [fooBar], output: fooBar};
              await loadIndividualPlugin("github", options);

              expect(execDependencyGraph).not.toHaveBeenCalled();
              expect(loadGithubData).toHaveBeenCalledTimes(1);
              expect(loadGithubData).toHaveBeenCalledWith({
                token: fakeGithubToken,
                repoIds: [fooBar],
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

            it("fails if a token is not provided", () => {
              expect.assertions(1);
              delete process.env.SOURCECRED_GITHUB_TOKEN;
              const result = loadIndividualPlugin("github", {
                repoIds: [fooBar],
                output: fooBar,
              });
              return expect(result).rejects.toThrow(
                "no SOURCECRED_GITHUB_TOKEN set"
              );
            });

            it("fails if `loadGithubData` rejects", async () => {
              loadGithubData.mockRejectedValueOnce(Error("GitHub is down"));
              const result = loadIndividualPlugin("github", {
                repoIds: [fooBar],
                output: fooBar,
              });
              expect(result).rejects.toThrow("GitHub is down");
            });
          });
        });
      });
    });
  });

  describe("loadDefaultPlugins", () => {
    const fooCombined = makeRepoId("foo", "combined");
    const fooBar = makeRepoId("foo", "bar");
    const fooBaz = makeRepoId("foo", "baz");
    const loadDefaultPlugins = makeLoadDefaultPlugins(jest.fn(), jest.fn());

    it("creates a load sub-task per plugin", async () => {
      execDependencyGraph.mockResolvedValue({success: true});
      await loadDefaultPlugins({
        output: fooCombined,
        repoIds: [fooBar, fooBaz],
      });
      expect(execDependencyGraph).toHaveBeenCalledTimes(1);
      const loadTasks = execDependencyGraph.mock.calls[0][0];
      expect(loadTasks).toHaveLength(defaultPlugins.length);
      expect(loadTasks.map((task) => task.id)).toEqual(
        expect.arrayContaining(defaultPlugins.map((x) => `load-${x}`))
      );
      for (const task of loadTasks) {
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

    it("updates RepoIdRegistry on success", async () => {
      const directory = newSourcecredDirectory();
      expect(RepoIdRegistry.getRegistry(directory)).toEqual(
        RepoIdRegistry.emptyRegistry()
      );
      execDependencyGraph.mockResolvedValue({success: true});
      await loadDefaultPlugins({
        output: fooCombined,
        repoIds: [fooBar, fooBaz],
      });
      const expectedRegistry = RepoIdRegistry.addEntry(
        RepoIdRegistry.emptyRegistry(),
        {
          repoId: fooCombined,
        }
      );
      expect(RepoIdRegistry.getRegistry(directory)).toEqual(expectedRegistry);
    });

    it("calls saveGraph on success", async () => {
      const saveGraph = jest.fn();
      const loadDefaultPlugins = makeLoadDefaultPlugins(saveGraph, jest.fn());
      execDependencyGraph.mockResolvedValue({success: true});
      await loadDefaultPlugins({
        output: fooCombined,
        repoIds: [fooBar, fooBaz],
      });
      expect(saveGraph).toHaveBeenCalledTimes(1);
      expect(saveGraph).toHaveBeenCalledWith(
        defaultAdapterLoaders(),
        fooCombined
      );
    });

    it("calls saveCred with the output of saveGraph", async () => {
      // $ExpectFlowError
      const graph: Graph = "pretend_graph";
      const saveGraph = jest.fn().mockResolvedValue(graph);
      const saveCred = jest.fn();
      const loadDefaultPlugins = makeLoadDefaultPlugins(saveGraph, saveCred);
      execDependencyGraph.mockResolvedValue({success: true});
      await loadDefaultPlugins({
        output: fooCombined,
        repoIds: [fooBar, fooBaz],
      });
      expect(saveCred).toHaveBeenCalledTimes(1);
      expect(saveCred).toHaveBeenCalledWith(graph, fooCombined, undefined);
    });

    it("calls saveCred with the weight path if set in the options", async () => {
      // $ExpectFlowError
      const graph: Graph = "pretend_graph";
      const saveGraph = jest.fn().mockResolvedValue(graph);
      const saveCred = jest.fn();
      const loadDefaultPlugins = makeLoadDefaultPlugins(saveGraph, saveCred);
      execDependencyGraph.mockResolvedValue({success: true});
      await loadDefaultPlugins({
        output: fooCombined,
        repoIds: [fooBar, fooBaz],
        weightsPath: "./my-weights.json",
      });
      expect(saveCred).toHaveBeenCalledTimes(1);
      expect(saveCred).toHaveBeenCalledWith(
        graph,
        fooCombined,
        "./my-weights.json"
      );
    });

    it("throws an load error on first execDependencyGraph failure", async () => {
      execDependencyGraph.mockResolvedValueOnce({success: false});
      const result = loadDefaultPlugins({
        output: fooCombined,
        repoIds: [fooBar, fooBaz],
      });

      expect(result).rejects.toThrow("Load tasks failed.");
    });
  });
});
