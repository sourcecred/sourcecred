// @flow
// Implementation of `sourcecred load`

import dedent from "../util/dedent";
import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import * as Common from "./common";
import * as Weights from "../core/weights";
import {projectFromJSON} from "../core/project";
import {load} from "../api/load";
import {specToProject} from "../plugins/github/specToProject";
import fs from "fs-extra";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {declaration as discourseDeclaration} from "../plugins/discourse/declaration";
import {declaration as githubDeclaration} from "../plugins/github/declaration";
import {declaration as identityDeclaration} from "../plugins/identity/declaration";
import {partialParams} from "../analysis/timeline/params";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred load [PROJECT_SPEC...]
                           [--weights WEIGHTS_FILE]
                           [--project PROJECT_FILE]
           sourcecred load --help

    Load a target project, generating a cred attribution for it.

    PROJET_SPEC is a string that describes a project.
    Currently, it must be a GitHub repository in the form OWNER/NAME: for
    example, torvalds/linux. Support for more PROJECT_SPECS will be added
    shortly.

    Arguments:
        PROJECT_SPEC:
            Identifier of a project to load.

        --project PROJECT_FILE
            Path to a json file which contains a project configuration.
            That project will be loaded.

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

        SOURCECRED_INITIATIVES_DIRECTORY
            Local path to a directory containing json files with
            initiative declarations. Required when using the Initiatives
            plugin; ignored otherwise.

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
  const projectPaths: string[] = [];
  let weightsPath: ?string;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help": {
        usage(std.out);
        return 0;
      }
      case "--weights": {
        if (weightsPath != null)
          return die(std, "'--weights' given multiple times");
        if (++i >= args.length)
          return die(std, "'--weights' given without value");
        weightsPath = args[i];
        break;
      }
      case "--project": {
        if (++i >= args.length)
          return die(std, "'--project' given without value");
        projectPaths.push(args[i]);
        break;
      }
      default: {
        projectSpecs.push(args[i]);
        break;
      }
    }
  }
  if (projectSpecs.length === 0 && projectPaths.length === 0) {
    return die(std, "projects not specified");
  }

  let weights = Weights.empty();
  if (weightsPath) {
    weights = await loadWeightOverrides(weightsPath);
  }

  const initiativesDirectory = Common.initiativesDirectory();
  const githubToken = Common.githubToken();
  if (githubToken == null) {
    return die(std, "SOURCECRED_GITHUB_TOKEN not set");
  }

  const taskReporter = new LoggingTaskReporter();

  const specProjects = await Promise.all(
    projectSpecs.map((s) => specToProject(s, githubToken))
  );
  const manualProjects = await Promise.all(projectPaths.map(loadProject));
  const projects = specProjects.concat(manualProjects);
  const optionses = projects.map((project) => {
    const plugins: PluginDeclaration[] = [];
    if (project.discourseServer != null) {
      plugins.push(discourseDeclaration);
    }
    if (project.repoIds.length) {
      plugins.push(githubDeclaration);
    }
    if (project.identities.length) {
      plugins.push(identityDeclaration);
    }
    const params = partialParams(project.params);

    return {
      project,
      params,
      weightsOverrides: weights,
      plugins,
      sourcecredDirectory: Common.sourcecredDirectory(),
      githubToken,
      initiativesDirectory,
    };
  });
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
    return Weights.fromJSON(weightsJSON);
  } catch (e) {
    throw new Error(`provided weights file is invalid:\n${e}`);
  }
};

const loadProject = async (path: string) => {
  if (!(await fs.exists(path))) {
    throw new Error(`Project path ${path} does not exist`);
  }

  const raw = await fs.readFile(path, "utf-8");
  const json = JSON.parse(raw);
  try {
    return projectFromJSON(json);
  } catch (e) {
    throw new Error(`project at path ${path} is invalid:\n${e}`);
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
