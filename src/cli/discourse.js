// @flow
// Implementation of `sourcecred discourse`
// This is a (likely temporary command) to facilitate loading a single
// discourse server.

import dedent from "../util/dedent";
import {LoggingTaskReporter} from "../util/taskReporter";
import type {Command} from "./command";
import * as Common from "./common";
import {defaultWeights} from "../analysis/weights";
import {load} from "../api/load";
import {declaration as discourseDeclaration} from "../plugins/discourse/declaration";
import {type Project} from "../core/project";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred discourse DISCOURSE_URL DISCOURSE_USERNAME
                                [--weights WEIGHTS_FILE]
           sourcecred discourse --help

    Loads a target Discourse server, generating cred scores for it.

    Arguments:
        DISCOURSE_URL
            The url to the Discourse server in question, for example
            https://discourse.sourcecred.io

        DISCOURSE_USERNAME
            A user account on the Discourse server, to be used as the
            "perspective" for the Discourse API calls. This user should not be
            a privileged or admin user, otherwise hidden or deleted topics may
            be included in the results. We recommend making a new user called
            "credbot" on the server, with no special roles or permissions.

        --weights WEIGHTS_FILE
            Path to a json file which contains a weights configuration.
            This will be used instead of the default weights and persisted.

        --help
            Show this help message and exit, as 'sourcecred help discourse'.

    Environment variables:
        SOURCECRED_DISCOURSE_KEY
            A Discourse admin API key generated from discourse server in
            question.

            To generate a key, use the /admin/api/keys route on your Discourse
            server, e.g. https://discourse.example.com/admin/api/keys

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
  std.err("fatal: run 'sourcecred help discourse' for help");
  return 1;
}

const command: Command = async (args, std) => {
  const positionalArgs = [];
  let weightsPath: string | null = null;

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
        positionalArgs.push(args[i]);
        break;
      }
    }
  }
  if (positionalArgs.length !== 2) {
    return die(std, "Expected two positional arguments (or --help).");
  }
  const [serverUrl, apiUsername] = positionalArgs;
  let projectId = serverUrl;
  if (projectId.startsWith("https://")) {
    projectId = projectId.slice("https://".length);
  } else if (projectId.startsWith("http://")) {
    projectId = projectId.slice("http://".length);
  } else {
    die(std, "expected server url to start with 'https://' or 'http://'");
  }

  const project: Project = {
    id: projectId,
    repoIds: [],
    discourseServer: {serverUrl, apiUsername},
  };
  const taskReporter = new LoggingTaskReporter();
  let weights = defaultWeights();
  if (weightsPath) {
    weights = await Common.loadWeights(weightsPath);
  }
  const plugins = [discourseDeclaration];

  await load(
    {
      project,
      params: {weights},
      plugins,
      sourcecredDirectory: Common.sourcecredDirectory(),
      githubToken: null,
      discourseKey: Common.discourseKey(),
    },
    taskReporter
  );
  return 0;
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

export default command;
