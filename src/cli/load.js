// @flow
// Implementation of `sourcecred load`

import dedent from "../util/dedent";
import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import * as Common from "./common";
import {defaultWeights, fromJSON as weightsFromJSON} from "../analysis/weights";
import {load} from "../api/load";
import {specToProject} from "../plugins/github/specToProject";
import fs from "fs-extra";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred load [PROJECT_SPEC...]
                           [--weights WEIGHTS_FILE]
           sourcecred load --help

    Load a target project, generating a cred attribution for it.

    PROJET_SPEC is a string that describes a project.
    Currently, it must be a GitHub repository in the form OWNER/NAME: for
    example, torvalds/linux. Support for more PROJECT_SPECS will be added
    shortly.

    Arguments:
        PROJECT_SPEC:
            Identifier of a project to load.

        --weights WEIGHTS_FILE
            Path to a json file which contains a weights configuration.
            This will be used instead of the default weights and persisted.

        --help
            Show this help message and exit, as 'sourcecred help load'.

    Environment variables:
        SOURCECRED_GITHUB_TOKEN
            API token for GitHub. This should be a 40-character hex
            string. Required if using the GitHub plugin; ignored
            otherwise.

            To generate a token, create a "Personal access token" at
            <https://github.com/settings/tokens>. When loading data for
            public repositories, no special permissions are required.
            For private repositories, the 'repo' scope is required.

        SOURCECRED_DIRECTORY
            Directory owned by SourceCred, in which data, caches,
            registries, etc. are stored. Optional: defaults to a
            directory 'sourcecred' under your OS's temporary directory;
            namely:
                ${Common.defaultSourcecredDirectory()}
    `.trimRight()
  );
}

function die(std, message) {
  std.err("fatal: " + message);
  std.err("fatal: run 'sourcecred help load' for help");
  return 1;
}

const loadCommand: Command = async (args, std) => {
  const projectSpecs: string[] = [];
  let weightsPath: ?string;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help": {
        usage(std.out);
        return 0;
      }
      case "--weights": {
        if (weightsPath != undefined)
          return die(std, "'--weights' given multiple times");
        if (++i >= args.length)
          return die(std, "'--weights' given without value");
        weightsPath = args[i];
        break;
      }
      default: {
        projectSpecs.push(args[i]);
        break;
      }
    }
  }
  if (projectSpecs.length == 0) {
    return die(std, "projects not specified");
  }

  let weights = defaultWeights();
  if (weightsPath) {
    weights = await loadWeightOverrides(weightsPath);
  }

  const githubToken = Common.githubToken();
  if (githubToken == null) {
    return die(std, "SOURCECRED_GITHUB_TOKEN not set");
  }

  const taskReporter = new LoggingTaskReporter();

  const projects = await Promise.all(
    projectSpecs.map((s) => specToProject(s, githubToken))
  );
  const params = {alpha: 0.05, intervalDecay: 0.5, weights};
  const optionses = projects.map((project) => ({
    project,
    params,
    sourcecredDirectory: Common.sourcecredDirectory(),
    githubToken,
    discourseKey: null,
  }));
  // Deliberately load in serial because GitHub requests that their API not
  // be called concurrently
  for (const options of optionses) {
    await load(options, taskReporter);
  }
  return 0;
};

const loadWeightOverrides = async (path: string) => {
  if (!(await fs.exists(path))) {
    throw new Error("Could not find the weights file");
  }

  const raw = await fs.readFile(path, "utf-8");
  const weightsJSON = JSON.parse(raw);
  try {
    return weightsFromJSON(weightsJSON);
  } catch (e) {
    throw new Error(`provided weights file is invalid:\n${e}`);
  }
};

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

export default loadCommand;
