// @flow

import tmp from "tmp";
import fs from "fs-extra";

import {LoggingTaskReporter} from "../util/taskReporter";
import {NodeAddress} from "../core/graph";
import {run} from "./testUtil";
import loadCommand, {help} from "./load";
import type {LoadOptions} from "../api/load";
import * as Weights from "../core/weights";
import * as Common from "./common";
import {declaration as githubDeclaration} from "../plugins/github/declaration";
import {createProject} from "../core/project";
import {makeRepoId, stringToRepoId} from "../plugins/github/repoId";
import {validateToken} from "../plugins/github/token";
import {defaultParams} from "../analysis/timeline/params";

jest.mock("../api/load", () => ({load: jest.fn()}));
type JestMockFn = $Call<typeof jest.fn>;
const load: JestMockFn = (require("../api/load").load: any);

describe("cli/load", () => {
  const exampleGithubToken = validateToken("0".repeat(40));
  beforeEach(() => {
    jest.clearAllMocks();
    // Tests should call `newSourcecredDirectory` directly when they
    // need the value. We call it here in case a test needs it to be set
    // but does not care about the particular value.
    newSourcecredDirectory();
  });

  function newSourcecredDirectory() {
    const dirname = tmp.dirSync().name;
    process.env.SOURCECRED_DIRECTORY = dirname;
    process.env.SOURCECRED_GITHUB_TOKEN = exampleGithubToken;
    process.env.SOURCECRED_INITIATIVES_DIRECTORY = tmp.dirSync().name;
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
    it("prints usage with '--help'", async () => {
      expect(await run(loadCommand, ["--help"])).toEqual({
        exitCode: 0,
        stdout: expect.arrayContaining([
          expect.stringMatching(/^usage: sourcecred load/),
        ]),
        stderr: [],
      });
    });

    it("calls load with a single repo", async () => {
      const invocation = run(loadCommand, ["foo/bar"]);
      const expectedOptions: LoadOptions = {
        project: createProject({
          id: "foo/bar",
          repoIds: [makeRepoId("foo", "bar")],
        }),
        params: defaultParams(),
        weightsOverrides: Weights.empty(),
        plugins: [githubDeclaration],
        sourcecredDirectory: Common.sourcecredDirectory(),
        githubToken: exampleGithubToken,
        initiativesDirectory: Common.initiativesDirectory(),
      };
      expect(await invocation).toEqual({
        exitCode: 0,
        stdout: [],
        stderr: [],
      });
      expect(load).toHaveBeenCalledWith(
        expectedOptions,
        expect.any(LoggingTaskReporter)
      );
    });

    it("calls load with multiple repos", async () => {
      const invocation = run(loadCommand, ["foo/bar", "zoink/zod"]);
      const expectedOptions: (string) => LoadOptions = (projectId: string) => ({
        project: createProject({
          id: projectId,
          repoIds: [stringToRepoId(projectId)],
        }),
        params: defaultParams(),
        weightsOverrides: Weights.empty(),
        plugins: [githubDeclaration],
        sourcecredDirectory: Common.sourcecredDirectory(),
        githubToken: exampleGithubToken,
        initiativesDirectory: Common.initiativesDirectory(),
      });
      expect(await invocation).toEqual({
        exitCode: 0,
        stdout: [],
        stderr: [],
      });
      expect(load).toHaveBeenCalledWith(
        expectedOptions("foo/bar"),
        expect.any(LoggingTaskReporter)
      );
      expect(load).toHaveBeenCalledWith(
        expectedOptions("zoink/zod"),
        expect.any(LoggingTaskReporter)
      );
    });

    it("loads the weights, if provided", async () => {
      const weights = Weights.empty();
      weights.nodeWeights.set(NodeAddress.empty, 33);
      const weightsJSON = Weights.toJSON(weights);
      const weightsFile = tmp.tmpNameSync();
      fs.writeFileSync(weightsFile, JSON.stringify(weightsJSON));
      const invocation = run(loadCommand, [
        "foo/bar",
        "--weights",
        weightsFile,
      ]);
      const expectedOptions: LoadOptions = {
        project: createProject({
          id: "foo/bar",
          repoIds: [makeRepoId("foo", "bar")],
        }),
        params: defaultParams(),
        weightsOverrides: weights,
        plugins: [githubDeclaration],
        sourcecredDirectory: Common.sourcecredDirectory(),
        githubToken: exampleGithubToken,
        initiativesDirectory: Common.initiativesDirectory(),
      };
      expect(await invocation).toEqual({
        exitCode: 0,
        stdout: [],
        stderr: [],
      });
      expect(load).toHaveBeenCalledWith(
        expectedOptions,
        expect.any(LoggingTaskReporter)
      );
    });

    describe("errors if", () => {
      async function expectFailure({args, message}) {
        expect(await run(loadCommand, args)).toEqual({
          exitCode: 1,
          stdout: [],
          stderr: message,
        });
        expect(load).not.toHaveBeenCalled();
      }

      it("no projects specified", async () => {
        await expectFailure({
          args: [],
          message: [
            "fatal: projects not specified",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });

      it("the weights file does not exist", async () => {
        const weightsFile = tmp.tmpNameSync();
        await expectFailure({
          args: ["foo/bar", "--weights", weightsFile],
          message: [
            expect.stringMatching("^Error: Could not find the weights file"),
          ],
        });
      });

      it("the weights file is invalid", async () => {
        const weightsFile = tmp.tmpNameSync();
        fs.writeFileSync(weightsFile, JSON.stringify({weights: 3}));
        await expectFailure({
          args: ["foo/bar", "--weights", weightsFile],
          message: [
            expect.stringMatching("^Error: provided weights file is invalid"),
          ],
        });
      });

      it("the repo identifier is invalid", async () => {
        await expectFailure({
          args: ["missing_delimiter"],
          message: [
            expect.stringMatching("^Error: invalid spec: missing_delimiter"),
          ],
        });
      });

      it("the SOURCECRED_GITHUB_TOKEN is unset", async () => {
        delete process.env.SOURCECRED_GITHUB_TOKEN;
        await expectFailure({
          args: ["missing_delimiter"],
          message: [
            "fatal: SOURCECRED_GITHUB_TOKEN not set",
            "fatal: run 'sourcecred help load' for help",
          ],
        });
      });
    });
  });
});
